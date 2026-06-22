// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {IERC20} from "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";
import {Pausable} from "@openzeppelin/contracts/utils/Pausable.sol";
import {ReentrancyGuard} from "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/// @title LeptonArena — On-chain agent battle arena (RPS with adaptive house + staked PvP)
/// @author Ported from Dirac (Vara) for the Lepton Agents Hackathon on Arc
/// @notice Rock-Paper-Scissors arena where autonomous agents duel an adaptive house,
///         pay nanopayments to enter, earn USDC, and climb an Elo leaderboard.
///         Also supports commit-reveal staked PvP between any two agents.
contract LeptonArena is Ownable, Pausable, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ──────────────────────────────────────────────────────────────────────
    //  Constants
    // ──────────────────────────────────────────────────────────────────────

    int32 public constant STARTING_RATING = 1500;
    uint8 public constant RECENT_WINDOW = 8;

    int32 private constant SCORE_SCALE = 1000;
    int32 private constant SCORE_WIN = 1000;
    int32 private constant SCORE_DRAW = 500;
    int32 private constant SCORE_LOSS = 0;
    int32 private constant RATING_DIFF_CLAMP = 800;
    int32 private constant TABLE_STEP = 25;

    uint256 private constant EPSILON_DENOMINATOR = 10_000;
    uint8 private constant NOT_REVEALED = 0xFF;

    /// @dev Elo expected-score lookup table (1:1 from dirac-logic).
    ///      Index i → E(score) when rating diff = i * 25, scaled by 1000.
    int32[33] private EXPECTED_SCORE_TABLE = [
        int32(500), 464, 429, 394, 360, 327, 297, 267, 240, 215,
        192, 170, 151, 133, 118, 104, 91, 80, 70, 61,
        53, 46, 40, 35, 31, 27, 23, 20, 17, 15,
        13, 11, 10
    ];

    // ──────────────────────────────────────────────────────────────────────
    //  Enums
    // ──────────────────────────────────────────────────────────────────────

    enum Move { Rock, Paper, Scissors }                                // 0, 1, 2
    enum Outcome { Win, Loss, Draw }
    enum MatchState { AwaitingOpponent, AwaitingReveal, Settled, Refunded }

    // ──────────────────────────────────────────────────────────────────────
    //  Structs
    // ──────────────────────────────────────────────────────────────────────

    struct Config {
        uint64 houseEpsilonBps;       // randomness ε (default 2000 = 20%)
        int32  eloK;                  // K-factor (default 32)
        int32  houseRating;           // house baseline (default 1500)
        uint32 leaderboardCapacity;   // max top-N entries (default 100)
        uint16 rakeBps;               // PvP rake in basis points (default 250 = 2.5%)
        uint32 revealDeadlineBlocks;  // blocks before timeout (default 1200)
        uint256 minStakeUsdc;         // minimum PvP stake
        uint256 maxStakeUsdc;         // maximum PvP stake
        uint256 entryFeeUsdc;         // play() entry fee (0 = free)
    }

    struct PlayerRecord {
        int32  rating;
        uint32 games;
        uint32 wins;
        uint32 losses;
        uint32 draws;
        uint32[3] moveCounts;         // lifetime [Rock, Paper, Scissors]
        uint8  recentHead;            // ring buffer write pointer
        uint8  recentLen;             // current fill (max RECENT_WINDOW)
        uint8[8] recentMoves;         // ring buffer of move values (0/1/2)
        bool   initialized;           // has played at least once
    }

    struct PvpMatch {
        address challenger;
        address opponent;
        bytes32 challengerCommit;
        bytes32 opponentCommit;
        uint8   challengerReveal;     // NOT_REVEALED or Move value
        uint8   opponentReveal;       // NOT_REVEALED or Move value
        uint256 stakeAmount;          // USDC per side
        uint32  deadlineBlock;
        MatchState state;
    }

    struct LeaderboardEntry {
        address player;
        int32   rating;
    }

    struct RoundResult {
        uint8 playerMove;
        uint8 houseMove;
        uint8 outcome;
        int32 newRating;
    }

    // ──────────────────────────────────────────────────────────────────────
    //  Events
    // ──────────────────────────────────────────────────────────────────────

    event MatchPlayed(
        uint256 indexed matchId,
        address indexed player,
        uint8 playerMove,
        uint8 houseMove,
        uint8 outcome,
        int32 newRating
    );

    event NewChampion(address indexed player, int32 rating);

    event ChallengeOpened(
        uint256 indexed matchId,
        address indexed challenger,
        address indexed opponent,
        uint256 stakeUsdc,
        uint32 deadlineBlock
    );

    event ChallengeAccepted(uint256 indexed matchId, uint32 deadlineBlock);

    event PvpResolved(
        uint256 indexed matchId,
        address winner,
        uint8 challengerMove,
        uint8 opponentMove,
        uint256 payout
    );

    event MatchForfeited(uint256 indexed matchId, address winner, address loser);
    event MatchRefunded(uint256 indexed matchId);
    event PotSeeded(uint256 amount, uint256 newPot);
    event ConfigUpdated();

    // ──────────────────────────────────────────────────────────────────────
    //  State
    // ──────────────────────────────────────────────────────────────────────

    IERC20 public immutable usdc;
    Config public config;
    uint256 public pot;
    uint256 public nextMatchId;

    mapping(address => PlayerRecord) public players;
    mapping(uint256 => PvpMatch) public matches;

    /// @dev Leaderboard stored as a bounded array, sorted desc by rating.
    LeaderboardEntry[] private _leaderboard;

    // ──────────────────────────────────────────────────────────────────────
    //  Constructor
    // ──────────────────────────────────────────────────────────────────────

    /// @param _usdc Address of the USDC ERC-20 on Arc
    /// @param _owner Admin/operator address
    constructor(address _usdc, address _owner) Ownable(_owner) {
        require(_usdc != address(0), "zero USDC address");
        usdc = IERC20(_usdc);

        config = Config({
            houseEpsilonBps: 2000,
            eloK: 32,
            houseRating: 1500,
            leaderboardCapacity: 100,
            rakeBps: 250,
            revealDeadlineBlocks: 1200,
            minStakeUsdc: 1,          // 0.000001 USDC (1 micro-unit, 6 decimals)
            maxStakeUsdc: 1000e6,     // 1000 USDC
            entryFeeUsdc: 0           // free by default
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CORE: House Duel
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Duel the adaptive house. Optionally charges an entry fee.
    /// @param playerMove 0=Rock, 1=Paper, 2=Scissors
    /// @return result The round result (playerMove, houseMove, outcome, newRating)
    function play(uint8 playerMove) external whenNotPaused nonReentrant returns (RoundResult memory result) {
        require(playerMove <= 2, "invalid move");

        // Charge entry fee if configured
        if (config.entryFeeUsdc > 0) {
            usdc.safeTransferFrom(msg.sender, address(this), config.entryFeeUsdc);
            pot += config.entryFeeUsdc;
        }

        uint256 matchId = nextMatchId++;
        PlayerRecord storage record = _ensurePlayer(msg.sender);

        // Adaptive house plays
        uint8 house = _houseMove(record, matchId);
        uint8 outcome = _resolve(playerMove, house);

        // Elo update
        int32 scoreMilli = _scoreMilli(outcome);
        int32 delta = _ratingDelta(record.rating, config.houseRating, scoreMilli);
        record.rating += delta;
        record.games += 1;
        _bumpOutcome(record, outcome);

        // Update move history
        record.moveCounts[playerMove] += 1;
        record.recentMoves[record.recentHead] = playerMove;
        record.recentHead = uint8((uint256(record.recentHead) + 1) % RECENT_WINDOW);
        if (record.recentLen < RECENT_WINDOW) {
            record.recentLen += 1;
        }

        int32 newRating = record.rating;

        // Update leaderboard
        bool championChanged = _updateLeaderboard(msg.sender, newRating);

        emit MatchPlayed(matchId, msg.sender, playerMove, house, outcome, newRating);
        if (championChanged) {
            emit NewChampion(msg.sender, newRating);
        }

        result = RoundResult({
            playerMove: playerMove,
            houseMove: house,
            outcome: outcome,
            newRating: newRating
        });
    }

    // ══════════════════════════════════════════════════════════════════════
    //  CORE: Staked PvP (Commit-Reveal)
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Open a staked PvP challenge.
    /// @param opponent The opponent's address
    /// @param commit keccak256(abi.encodePacked(uint8(move), salt))
    /// @param stakeAmount USDC stake amount (per side)
    /// @return matchId The new match ID
    function challenge(
        address opponent,
        bytes32 commit,
        uint256 stakeAmount
    ) external whenNotPaused nonReentrant returns (uint256 matchId) {
        require(opponent != msg.sender, "cannot self-challenge");
        require(opponent != address(0), "zero opponent");
        require(stakeAmount >= config.minStakeUsdc, "stake below min");
        require(stakeAmount <= config.maxStakeUsdc, "stake above max");
        require(commit != bytes32(0), "empty commit");

        // Pull USDC stake
        usdc.safeTransferFrom(msg.sender, address(this), stakeAmount);

        matchId = nextMatchId++;
        uint32 deadline = uint32(block.number) + config.revealDeadlineBlocks;

        matches[matchId] = PvpMatch({
            challenger: msg.sender,
            opponent: opponent,
            challengerCommit: commit,
            opponentCommit: bytes32(0),
            challengerReveal: NOT_REVEALED,
            opponentReveal: NOT_REVEALED,
            stakeAmount: stakeAmount,
            deadlineBlock: deadline,
            state: MatchState.AwaitingOpponent
        });

        emit ChallengeOpened(matchId, msg.sender, opponent, stakeAmount, deadline);
    }

    /// @notice Accept a challenge by committing your move and staking.
    /// @param matchId The match to accept
    /// @param commit keccak256(abi.encodePacked(uint8(move), salt))
    function acceptChallenge(
        uint256 matchId,
        bytes32 commit
    ) external whenNotPaused nonReentrant {
        PvpMatch storage m = matches[matchId];
        require(m.state == MatchState.AwaitingOpponent, "not open");
        require(m.opponent == msg.sender, "not the challenged opponent");
        require(commit != bytes32(0), "empty commit");

        // Pull matching stake
        usdc.safeTransferFrom(msg.sender, address(this), m.stakeAmount);

        m.opponentCommit = commit;
        m.deadlineBlock = uint32(block.number) + config.revealDeadlineBlocks;
        m.state = MatchState.AwaitingReveal;

        emit ChallengeAccepted(matchId, m.deadlineBlock);
    }

    /// @notice Reveal your committed move. Settles automatically when both reveal.
    /// @param matchId The match ID
    /// @param playerMove 0=Rock, 1=Paper, 2=Scissors
    /// @param salt The 32-byte salt used in the commit
    function reveal(
        uint256 matchId,
        uint8 playerMove,
        bytes32 salt
    ) external whenNotPaused nonReentrant {
        require(playerMove <= 2, "invalid move");
        PvpMatch storage m = matches[matchId];
        require(m.state == MatchState.AwaitingReveal, "not awaiting reveal");

        bytes32 computedCommit = keccak256(abi.encodePacked(playerMove, salt));

        if (msg.sender == m.challenger) {
            require(computedCommit == m.challengerCommit, "reveal mismatch");
            require(m.challengerReveal == NOT_REVEALED, "already revealed");
            m.challengerReveal = playerMove;
        } else if (msg.sender == m.opponent) {
            require(computedCommit == m.opponentCommit, "reveal mismatch");
            require(m.opponentReveal == NOT_REVEALED, "already revealed");
            m.opponentReveal = playerMove;
        } else {
            revert("not a participant");
        }

        // If both revealed, settle
        if (m.challengerReveal != NOT_REVEALED && m.opponentReveal != NOT_REVEALED) {
            _settle(matchId);
        }
    }

    /// @notice Claim a timed-out match. Forfeit to the revealer, or refund if neither revealed.
    /// @param matchId The match ID
    function claimTimeout(uint256 matchId) external nonReentrant {
        PvpMatch storage m = matches[matchId];
        require(block.number > m.deadlineBlock, "deadline not reached");

        if (m.state == MatchState.AwaitingOpponent) {
            // Opponent never showed — refund challenger
            m.state = MatchState.Refunded;
            usdc.safeTransfer(m.challenger, m.stakeAmount);
            emit MatchRefunded(matchId);

        } else if (m.state == MatchState.AwaitingReveal) {
            bool cRevealed = m.challengerReveal != NOT_REVEALED;
            bool oRevealed = m.opponentReveal != NOT_REVEALED;

            if (cRevealed && oRevealed) {
                // Both revealed but not yet settled (shouldn't happen normally)
                _settle(matchId);
            } else if (cRevealed && !oRevealed) {
                // Opponent forfeited
                _awardForfeit(matchId, m.challenger, m.opponent);
            } else if (!cRevealed && oRevealed) {
                // Challenger forfeited
                _awardForfeit(matchId, m.opponent, m.challenger);
            } else {
                // Neither revealed — refund both
                m.state = MatchState.Refunded;
                usdc.safeTransfer(m.challenger, m.stakeAmount);
                usdc.safeTransfer(m.opponent, m.stakeAmount);
                emit MatchRefunded(matchId);
            }
        } else {
            revert("match already settled");
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  VIEW FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Get the top N leaderboard entries.
    function getLeaderboard(uint256 topN) external view returns (LeaderboardEntry[] memory) {
        uint256 len = topN < _leaderboard.length ? topN : _leaderboard.length;
        LeaderboardEntry[] memory result = new LeaderboardEntry[](len);
        for (uint256 i = 0; i < len; i++) {
            result[i] = _leaderboard[i];
        }
        return result;
    }

    /// @notice Get a player's full record.
    function getPlayer(address who) external view returns (
        int32 rating,
        uint32 games,
        uint32 wins,
        uint32 losses,
        uint32 draws,
        uint32[3] memory moveCounts,
        bool initialized
    ) {
        PlayerRecord storage r = players[who];
        return (r.rating, r.games, r.wins, r.losses, r.draws, r.moveCounts, r.initialized);
    }

    /// @notice Get a PvP match's public state.
    function getMatch(uint256 matchId) external view returns (
        address challenger,
        address opponent,
        uint256 stakeAmount,
        uint32 deadlineBlock,
        MatchState state,
        bool challengerRevealed,
        bool opponentRevealed
    ) {
        PvpMatch storage m = matches[matchId];
        return (
            m.challenger,
            m.opponent,
            m.stakeAmount,
            m.deadlineBlock,
            m.state,
            m.challengerReveal != NOT_REVEALED,
            m.opponentReveal != NOT_REVEALED
        );
    }

    /// @notice Get the accumulated prize pot.
    function getPot() external view returns (uint256) {
        return pot;
    }

    /// @notice Get the current arena config.
    function getConfig() external view returns (Config memory) {
        return config;
    }

    /// @notice Get current leaderboard length.
    function getLeaderboardLength() external view returns (uint256) {
        return _leaderboard.length;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  ADMIN FUNCTIONS
    // ══════════════════════════════════════════════════════════════════════

    /// @notice Update arena configuration. Owner only.
    function setConfig(Config calldata newConfig) external onlyOwner {
        config = newConfig;
        emit ConfigUpdated();
    }

    /// @notice Pause the arena (blocks play, challenge, acceptChallenge, reveal). Owner only.
    function pause() external onlyOwner {
        _pause();
    }

    /// @notice Unpause the arena. Owner only.
    function unpause() external onlyOwner {
        _unpause();
    }

    /// @notice Seed the prize pool with USDC. Anyone can call.
    /// @param amount USDC amount to add to pot
    function seedPot(uint256 amount) external nonReentrant {
        require(amount > 0, "zero amount");
        usdc.safeTransferFrom(msg.sender, address(this), amount);
        pot += amount;
        emit PotSeeded(amount, pot);
    }

    /// @notice Withdraw from the prize pot. Owner only.
    /// @param to Recipient address
    /// @param amount USDC amount to withdraw
    function withdrawPot(address to, uint256 amount) external onlyOwner nonReentrant {
        require(amount <= pot, "exceeds pot");
        require(to != address(0), "zero recipient");
        pot -= amount;
        usdc.safeTransfer(to, amount);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL: Adaptive House Logic
    // ══════════════════════════════════════════════════════════════════════

    /// @dev Predict the player's most likely next move from their history.
    ///      Blends lifetime move frequency with recency weighting.
    ///      1:1 port from dirac-logic/house.rs predict().
    function _predict(PlayerRecord storage record) internal view returns (uint8) {
        int256[3] memory score;
        score[0] = int256(uint256(record.moveCounts[0]));
        score[1] = int256(uint256(record.moveCounts[1]));
        score[2] = int256(uint256(record.moveCounts[2]));

        // Recency weighting: newer moves get higher weight
        // Ring buffer traversal: oldest to newest
        if (record.recentLen > 0) {
            uint8 len = record.recentLen;
            // Start from the oldest entry in the ring buffer
            uint8 start;
            if (len == RECENT_WINDOW) {
                start = record.recentHead; // head points to next write = oldest
            } else {
                start = 0;
            }
            for (uint8 i = 0; i < len; i++) {
                uint8 idx = uint8((uint256(start) + uint256(i)) % RECENT_WINDOW);
                uint8 mv = record.recentMoves[idx];
                score[mv] += int256(uint256(i)) + 1; // position weight: 1, 2, 3...
            }
        }

        // Find the move with the highest score
        uint8 best = 0;
        if (score[1] > score[best]) best = 1;
        if (score[2] > score[best]) best = 2;
        return best;
    }

    /// @dev Return the move that beats the given move.
    function _counter(uint8 move_) internal pure returns (uint8) {
        // Rock(0) → Paper(1), Paper(1) → Scissors(2), Scissors(2) → Rock(0)
        return uint8((uint256(move_) + 1) % 3);
    }

    /// @dev Compute the house's move for this duel.
    ///      1:1 port from dirac-logic/house.rs house_move().
    function _houseMove(PlayerRecord storage record, uint256 matchId) internal view returns (uint8) {
        uint256 total = uint256(record.moveCounts[0])
                      + uint256(record.moveCounts[1])
                      + uint256(record.moveCounts[2]);

        uint256 rng = _rng(matchId);

        // No history → random move
        if (total == 0) {
            return uint8(rng % 3);
        }

        // Epsilon branch → random move
        if (rng % EPSILON_DENOMINATOR < config.houseEpsilonBps) {
            // Use a different part of the hash for the random move selection
            return uint8((rng / EPSILON_DENOMINATOR) % 3);
        }

        // Counter the predicted move
        return _counter(_predict(record));
    }

    /// @dev Deterministic RNG seeded from block entropy, match ID, and player address.
    ///      Replaces SplitMix64 + SHA-256 seed from Dirac.
    function _rng(uint256 matchId) internal view returns (uint256) {
        return uint256(keccak256(abi.encodePacked(block.prevrandao, matchId, msg.sender)));
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL: RPS Resolution
    // ══════════════════════════════════════════════════════════════════════

    /// @dev Resolve player vs opponent. Returns Outcome enum value.
    ///      1:1 port from dirac-logic/rps.rs resolve().
    function _resolve(uint8 player, uint8 opponent_) internal pure returns (uint8) {
        if (player == opponent_) return uint8(Outcome.Draw);
        // Win conditions: Rock>Scissors, Paper>Rock, Scissors>Paper
        // (player + 1) % 3 == opponent_ means player's successor is opponent → player LOSES
        // (player + 2) % 3 == opponent_ means opponent is player's predecessor → player WINS
        if ((player + 2) % 3 == opponent_) {
            return uint8(Outcome.Win);
        }
        return uint8(Outcome.Loss);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL: Elo System
    // ══════════════════════════════════════════════════════════════════════

    /// @dev Map Outcome to a score in milli-units (1000 = win, 500 = draw, 0 = loss).
    function _scoreMilli(uint8 outcome) internal pure returns (int32) {
        if (outcome == uint8(Outcome.Win)) return SCORE_WIN;
        if (outcome == uint8(Outcome.Draw)) return SCORE_DRAW;
        return SCORE_LOSS;
    }

    /// @dev Compute expected score using the lookup table with interpolation.
    ///      1:1 port from dirac-logic/elo.rs expected_score_milli().
    function _expectedScoreMilli(int32 player, int32 opponent_) internal view returns (int32) {
        int32 diff = opponent_ - player;
        if (diff > RATING_DIFF_CLAMP) diff = RATING_DIFF_CLAMP;
        if (diff < -RATING_DIFF_CLAMP) diff = -RATING_DIFF_CLAMP;

        if (diff >= 0) {
            return _interpolateExpected(diff);
        } else {
            return SCORE_SCALE - _interpolateExpected(-diff);
        }
    }

    /// @dev Interpolate within the expected score lookup table.
    function _interpolateExpected(int32 diff) internal view returns (int32) {
        uint256 index = uint256(uint32(diff / TABLE_STEP));
        int32 remainder = diff % TABLE_STEP;
        int32 low = EXPECTED_SCORE_TABLE[index];

        if (remainder == 0 || index + 1 == EXPECTED_SCORE_TABLE.length) {
            return low;
        }

        int32 high = EXPECTED_SCORE_TABLE[index + 1];
        return low + _roundDiv((high - low) * remainder, TABLE_STEP);
    }

    /// @dev Compute Elo rating change.
    ///      1:1 port from dirac-logic/elo.rs rating_delta().
    function _ratingDelta(int32 player, int32 opponent_, int32 scoreMilli_) internal view returns (int32) {
        int32 expected = _expectedScoreMilli(player, opponent_);
        return _roundDiv(config.eloK * (scoreMilli_ - expected), SCORE_SCALE);
    }

    /// @dev Integer division with rounding to nearest (symmetric).
    function _roundDiv(int256 numerator, int256 denominator) internal pure returns (int32) {
        int256 half = denominator / 2;
        if (numerator >= 0) {
            return int32((numerator + half) / denominator);
        } else {
            return int32((numerator - half) / denominator);
        }
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL: Outcome & Record Updates
    // ══════════════════════════════════════════════════════════════════════

    /// @dev Increment the win/loss/draw counter for a player.
    function _bumpOutcome(PlayerRecord storage record, uint8 outcome) internal {
        if (outcome == uint8(Outcome.Win)) {
            record.wins += 1;
        } else if (outcome == uint8(Outcome.Loss)) {
            record.losses += 1;
        } else {
            record.draws += 1;
        }
    }

    /// @dev Initialize a player record if they haven't played before.
    function _ensurePlayer(address who) internal returns (PlayerRecord storage) {
        PlayerRecord storage record = players[who];
        if (!record.initialized) {
            record.rating = STARTING_RATING;
            record.initialized = true;
        }
        return record;
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL: Leaderboard
    // ══════════════════════════════════════════════════════════════════════

    /// @dev Update the leaderboard with a player's new rating.
    ///      Maintains a sorted, bounded top-K list.
    ///      Returns true if the champion (rank 1) changed.
    ///      1:1 port from dirac-logic/leaderboard.rs update_leaderboard().
    function _updateLeaderboard(address player, int32 rating) internal returns (bool) {
        address previousChampion = _leaderboard.length > 0 ? _leaderboard[0].player : address(0);

        // Find existing entry
        bool found = false;
        uint256 foundIdx;
        for (uint256 i = 0; i < _leaderboard.length; i++) {
            if (_leaderboard[i].player == player) {
                _leaderboard[i].rating = rating;
                found = true;
                foundIdx = i;
                break;
            }
        }

        // If not found, append
        if (!found) {
            _leaderboard.push(LeaderboardEntry({player: player, rating: rating}));
        }

        // Sort descending by rating (insertion sort — efficient for nearly-sorted small arrays)
        _sortLeaderboard();

        // Truncate to capacity
        uint256 cap = config.leaderboardCapacity;
        while (_leaderboard.length > cap) {
            _leaderboard.pop();
        }

        // Check if champion changed
        address newChampion = _leaderboard.length > 0 ? _leaderboard[0].player : address(0);
        return newChampion != previousChampion;
    }

    /// @dev Insertion sort on the leaderboard (descending by rating, then by address for ties).
    ///      Efficient for bounded arrays where most elements are already sorted.
    function _sortLeaderboard() internal {
        uint256 len = _leaderboard.length;
        if (len <= 1) return;

        for (uint256 i = 1; i < len; i++) {
            LeaderboardEntry memory key = _leaderboard[i];
            uint256 j = i;
            while (j > 0 && _compareEntries(key, _leaderboard[j - 1])) {
                _leaderboard[j] = _leaderboard[j - 1];
                j--;
            }
            _leaderboard[j] = key;
        }
    }

    /// @dev Compare two leaderboard entries for sort order.
    ///      Higher rating first; ties broken by lower address (like Dirac).
    function _compareEntries(LeaderboardEntry memory a, LeaderboardEntry memory b) internal pure returns (bool) {
        if (a.rating != b.rating) return a.rating > b.rating;
        return uint160(a.player) < uint160(b.player);
    }

    // ══════════════════════════════════════════════════════════════════════
    //  INTERNAL: PvP Settlement
    // ══════════════════════════════════════════════════════════════════════

    /// @dev Settle a PvP match where both sides have revealed.
    function _settle(uint256 matchId) internal {
        PvpMatch storage m = matches[matchId];
        uint8 cMove = m.challengerReveal;
        uint8 oMove = m.opponentReveal;
        uint8 cOutcome = _resolve(cMove, oMove);

        // Update Elo for both players
        _applyPvpRatings(m.challenger, cOutcome, m.opponent, _flipOutcome(cOutcome));

        m.state = MatchState.Settled;
        uint256 stake = m.stakeAmount;

        if (cOutcome == uint8(Outcome.Draw)) {
            // Draw → refund both
            usdc.safeTransfer(m.challenger, stake);
            usdc.safeTransfer(m.opponent, stake);
            emit PvpResolved(matchId, address(0), cMove, oMove, stake * 2);
        } else {
            // Decisive → winner takes pot minus rake
            address winner = cOutcome == uint8(Outcome.Win) ? m.challenger : m.opponent;
            uint256 totalPot = stake * 2;
            uint256 rake = (totalPot * config.rakeBps) / 10_000;
            uint256 payout = totalPot - rake;

            pot += rake;
            usdc.safeTransfer(winner, payout);

            emit PvpResolved(matchId, winner, cMove, oMove, payout);
        }
    }

    /// @dev Award a forfeit when one player fails to reveal in time.
    function _awardForfeit(uint256 matchId, address winner, address loser) internal {
        PvpMatch storage m = matches[matchId];

        // Forfeit counts as Win/Loss for Elo
        _applyPvpRatings(winner, uint8(Outcome.Win), loser, uint8(Outcome.Loss));

        m.state = MatchState.Settled;
        uint256 stake = m.stakeAmount;
        uint256 totalPot = stake * 2;
        uint256 rake = (totalPot * config.rakeBps) / 10_000;
        uint256 payout = totalPot - rake;

        pot += rake;
        usdc.safeTransfer(winner, payout);

        emit MatchForfeited(matchId, winner, loser);
    }

    /// @dev Apply PvP Elo rating changes to both players and update leaderboard.
    function _applyPvpRatings(
        address a,
        uint8 aOutcome,
        address b,
        uint8 bOutcome
    ) internal {
        PlayerRecord storage rA = _ensurePlayer(a);
        PlayerRecord storage rB = _ensurePlayer(b);

        int32 aRating = rA.rating;
        int32 bRating = rB.rating;

        int32 aDelta = _ratingDelta(aRating, bRating, _scoreMilli(aOutcome));
        int32 bDelta = _ratingDelta(bRating, aRating, _scoreMilli(bOutcome));

        rA.rating += aDelta;
        rA.games += 1;
        _bumpOutcome(rA, aOutcome);

        rB.rating += bDelta;
        rB.games += 1;
        _bumpOutcome(rB, bOutcome);

        bool champA = _updateLeaderboard(a, rA.rating);
        bool champB = _updateLeaderboard(b, rB.rating);

        if (champA) {
            emit NewChampion(a, rA.rating);
        } else if (champB) {
            emit NewChampion(b, rB.rating);
        }
    }

    /// @dev Flip an outcome (Win↔Loss, Draw stays Draw).
    function _flipOutcome(uint8 outcome) internal pure returns (uint8) {
        if (outcome == uint8(Outcome.Win)) return uint8(Outcome.Loss);
        if (outcome == uint8(Outcome.Loss)) return uint8(Outcome.Win);
        return outcome; // Draw
    }
}
