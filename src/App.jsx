import React, { useEffect, useEffectEvent, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import wizardLogo from "../sw_logo.png";
import {
  AlertTriangle,
  CheckCircle2,
  Clock3,
  Eraser,
  Grid3X3,
  Lightbulb,
  NotebookPen,
  RotateCcw,
  Save,
  Settings,
  Trophy,
} from "lucide-react";

const MotionHeader = motion.header;
const MotionSection = motion.section;
const MotionAside = motion.aside;
const MotionButton = motion.button;

const DIFFICULTIES = {
  Easy: { clues: 38, hints: 8 },
  Medium: { clues: 30, hints: 3 },
  Hard: { clues: 24, hints: 0 },
};

const DEFAULT_SETTINGS = {
  timerEnabled: true,
  focusAura: true,
  remainingCounts: true,
  liveValidation: true,
};

const SETTINGS_STORAGE_KEY = "sudoku-wizard-settings";
const BEST_TIMES_STORAGE_KEY = "sudoku-wizard-best-times";

const SETTINGS_LIST = [
  {
    key: "timerEnabled",
    label: "Timer",
    description: "Track the current board time.",
  },
  {
    key: "focusAura",
    label: "Board guides",
    description: "Highlight the active row, column, 3x3 box, and matching digits.",
  },
  {
    key: "remainingCounts",
    label: "Show counters",
    description: "Display how many of each digit are still on the board.",
  },
  {
    key: "liveValidation",
    label: "Show mistakes",
    description: "Mark wrong numbers and show the mistake counter.",
  },
];

const range9 = Array.from({ length: 9 }, (_, index) => index + 1);

function shuffle(arr) {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function pattern(r, c) {
  return (3 * (r % 3) + Math.floor(r / 3) + c) % 9;
}

function generateSolvedBoard() {
  const rows = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((row) => group * 3 + row));
  const cols = shuffle([0, 1, 2]).flatMap((group) => shuffle([0, 1, 2]).map((col) => group * 3 + col));
  const nums = shuffle(range9);
  return rows.map((r) => cols.map((c) => nums[pattern(r, c)]));
}

function copyBoard(board) {
  return board.map((row) => [...row]);
}

function createEmptyNotes() {
  return Array.from({ length: 9 }, () => Array.from({ length: 9 }, () => []));
}

function copyNotes(notes) {
  return notes.map((row) => row.map((cell) => [...cell]));
}

function readStoredSettings() {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;

  try {
    const raw = window.localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) return DEFAULT_SETTINGS;
    return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

function readStoredBestTimes() {
  if (typeof window === "undefined") return {};

  try {
    const raw = window.localStorage.getItem(BEST_TIMES_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function generatePuzzle(difficulty) {
  const solution = generateSolvedBoard();
  const puzzle = copyBoard(solution);
  const clues = DIFFICULTIES[difficulty]?.clues ?? DIFFICULTIES.Medium.clues;
  let removals = 81 - clues;

  const positions = shuffle(Array.from({ length: 81 }, (_, index) => index));
  for (const pos of positions) {
    if (removals <= 0) break;
    const r = Math.floor(pos / 9);
    const c = pos % 9;
    puzzle[r][c] = 0;
    removals -= 1;
  }

  const fixed = puzzle.map((row) => row.map((value) => value !== 0));
  return { puzzle, solution, fixed };
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

function getBoxIndex(r, c) {
  return Math.floor(r / 3) * 3 + Math.floor(c / 3);
}

function countRemaining(board, solution) {
  const counts = Object.fromEntries(range9.map((digit) => [digit, 9]));
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      const value = board[r][c];
      if (value >= 1 && value <= 9 && value === solution[r][c]) counts[value] -= 1;
    }
  }
  return counts;
}

function isSolvedBoard(board, solution) {
  return board.every((row, r) => row.every((value, c) => value !== 0 && value === solution[r][c]));
}

function findHintTarget(board, fixed, selected) {
  if (selected.r !== null && selected.c !== null && !fixed[selected.r][selected.c]) {
    return selected;
  }

  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (!fixed[r][c] && board[r][c] === 0) return { r, c };
    }
  }

  return null;
}

function classNames(...classes) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export default function SudokuWizard() {
  const [difficulty, setDifficulty] = useState("Easy");
  const [settings, setSettings] = useState(readStoredSettings);
  const [bestTimes, setBestTimes] = useState(readStoredBestTimes);
  const [puzzleData, setPuzzleData] = useState(() => generatePuzzle("Easy"));
  const [seconds, setSeconds] = useState(0);
  const [selected, setSelected] = useState({ r: null, c: null });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [feedbackCells, setFeedbackCells] = useState({});
  const [mistakeCount, setMistakeCount] = useState(0);
  const [noteMode, setNoteMode] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [board, setBoard] = useState(puzzleData.puzzle);
  const [notes, setNotes] = useState(createEmptyNotes);

  const remaining = useMemo(() => countRemaining(board, puzzleData.solution), [board, puzzleData.solution]);
  const filledCount = useMemo(
    () => board.reduce((count, row) => count + row.filter((value) => value !== 0).length, 0),
    [board]
  );
  const completed = useMemo(() => isSolvedBoard(board, puzzleData.solution), [board, puzzleData.solution]);

  useEffect(() => {
    if (!settings.timerEnabled || completed) return undefined;

    const interval = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [settings.timerEnabled, completed]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  useEffect(() => {
    window.localStorage.setItem(BEST_TIMES_STORAGE_KEY, JSON.stringify(bestTimes));
  }, [bestTimes]);

  const selectedValue = selected.r !== null && selected.c !== null ? board[selected.r][selected.c] : null;
  const bestTime = bestTimes[difficulty];
  const hintLimit = DIFFICULTIES[difficulty].hints;
  const hintsRemaining = Math.max(0, hintLimit - hintCount);
  const progressLabel = `${filledCount}/81`;
  const mistakeDetail = mistakeCount === 0 ? "Clean run so far" : `${mistakeCount} total this board`;
  const selectedLabel =
    selected.r !== null && selected.c !== null ? `R${selected.r + 1} C${selected.c + 1}` : "None";
  const winMessage = completed
    ? `Solved${settings.timerEnabled ? ` in ${formatTime(seconds)}` : ""}${hintCount ? ` with ${hintCount} hint${hintCount === 1 ? "" : "s"}` : ""}.`
    : null;

  function triggerFeedback(key, type) {
    setFeedbackCells((current) => ({ ...current, [key]: type }));
    window.setTimeout(() => {
      setFeedbackCells((current) => {
        const next = { ...current };
        delete next[key];
        return next;
      });
    }, type === "wrong" ? 420 : 520);
  }

  function toggleNoteValue(r, c, num) {
    setNotes((current) => {
      const next = copyNotes(current);
      const cellNotes = next[r][c];
      next[r][c] = cellNotes.includes(num)
        ? cellNotes.filter((value) => value !== num)
        : [...cellNotes, num].sort((a, b) => a - b);
      return next;
    });
  }

  function setCellValue(num) {
    const { r, c } = selected;
    if (r === null || c === null || completed) return;
    if (puzzleData.fixed[r][c]) return;
    if (num === board[r][c]) return;

    if (noteMode && num !== 0 && board[r][c] === 0) {
      toggleNoteValue(r, c, num);
      return;
    }

    const nextBoard = copyBoard(board);
    nextBoard[r][c] = num;
    setBoard(nextBoard);
    maybeStoreBestTime(nextBoard);

    if (num !== 0 && num !== puzzleData.solution[r][c]) {
      setMistakeCount((current) => current + 1);
    }

    setNotes((current) => {
      const next = copyNotes(current);
      next[r][c] = [];
      return next;
    });

    if (num !== 0 && settings.liveValidation) {
      triggerFeedback(`${r}-${c}`, num === puzzleData.solution[r][c] ? "correct" : "wrong");
    }
  }

  function clearSelectedCell() {
    const { r, c } = selected;
    if (r === null || c === null || puzzleData.fixed[r][c] || completed) return;

    setBoard((current) => {
      const next = copyBoard(current);
      next[r][c] = 0;
      return next;
    });

    setNotes((current) => {
      const next = copyNotes(current);
      next[r][c] = [];
      return next;
    });
  }

  function maybeStoreBestTime(nextBoard) {
    if (!settings.timerEnabled || !isSolvedBoard(nextBoard, puzzleData.solution)) return;

    setBestTimes((current) => {
      const existing = current[difficulty];
      if (existing && existing <= seconds) return current;
      return { ...current, [difficulty]: seconds };
    });
  }

  function applyHint() {
    if (completed || hintsRemaining <= 0) return;

    const target = findHintTarget(board, puzzleData.fixed, selected);
    if (!target) return;

    const { r, c } = target;
    const nextValue = puzzleData.solution[r][c];
    const nextBoard = copyBoard(board);
    nextBoard[r][c] = nextValue;

    setSelected({ r, c });
    setHintCount((count) => count + 1);
    setBoard(nextBoard);
    maybeStoreBestTime(nextBoard);

    setNotes((current) => {
      const next = copyNotes(current);
      next[r][c] = [];
      return next;
    });

    triggerFeedback(`${r}-${c}`, "correct");
  }

  function loadFreshPuzzle(nextDifficulty = difficulty) {
    setShowResetConfirm(false);
    setDifficulty(nextDifficulty);

    const nextPuzzle = generatePuzzle(nextDifficulty);
    setPuzzleData(nextPuzzle);
    setBoard(nextPuzzle.puzzle);
    setNotes(createEmptyNotes());
    setSelected({ r: null, c: null });
    setSeconds(0);
    setFeedbackCells({});
    setMistakeCount(0);
    setNoteMode(false);
    setHintCount(0);
  }

  function moveSelection(rowDelta, colDelta) {
    setSelected((current) => ({
      r: clamp((current.r ?? 0) + rowDelta, 0, 8),
      c: clamp((current.c ?? 0) + colDelta, 0, 8),
    }));
  }

  const handleKeyDown = useEffectEvent((event) => {
    const tagName = document.activeElement?.tagName;
    if (tagName && ["INPUT", "TEXTAREA", "SELECT"].includes(tagName)) return;

    const lowerKey = event.key.toLowerCase();

    if (lowerKey === "n") {
      event.preventDefault();
      setNoteMode((current) => !current);
      return;
    }

    if (lowerKey === "h") {
      event.preventDefault();
      applyHint();
      return;
    }

    if (event.key === "Escape") {
      setSelected({ r: null, c: null });
      return;
    }

    if (selected.r === null || selected.c === null) return;

    if (/^[1-9]$/.test(event.key)) {
      event.preventDefault();
      setCellValue(Number(event.key));
      return;
    }

    if (event.key === "Backspace" || event.key === "Delete" || event.key === "0") {
      event.preventDefault();
      clearSelectedCell();
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      moveSelection(-1, 0);
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      moveSelection(1, 0);
      return;
    }

    if (event.key === "ArrowLeft") {
      event.preventDefault();
      moveSelection(0, -1);
      return;
    }

    if (event.key === "ArrowRight") {
      event.preventDefault();
      moveSelection(0, 1);
    }
  });

  useEffect(() => {
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  return (
    <div className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,#3a1245_0%,#17081f_45%,#050507_100%)] text-[#f6efff]">
      <div className="pointer-events-none absolute inset-0 opacity-70">
        <div className="absolute -left-12 top-0 h-72 w-72 rounded-full bg-[#ff74d9]/18 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[#8d5bff]/16 blur-3xl" />
        <div className="absolute bottom-0 left-1/3 h-72 w-72 rounded-full bg-[#9590a8]/10 blur-3xl" />
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <MotionHeader
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-white/8 bg-[#0f0b16]/82 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.36)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-[1.6rem] border border-white/10 bg-black/25 p-2 shadow-[0_16px_40px_rgba(0,0,0,0.28)]">
                <img src={wizardLogo} alt="Sudoku Wizard logo" className="h-20 w-auto sm:h-24" />
              </div>
              <div>
                <h1 className="text-4xl tracking-tight text-[#fbf5ff] sm:text-5xl [font-family:var(--font-display)]">
                  Sudoku Wizard
                </h1>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {Object.entries(DIFFICULTIES).map(([level, info]) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => loadFreshPuzzle(level)}
                  className={classNames(
                    "rounded-full border px-4 py-2.5 text-left transition-all duration-200",
                    difficulty === level
                      ? "border-[#ff93e4]/40 bg-[linear-gradient(135deg,#ff8fe1_0%,#9c62ff_100%)] text-[#1d0922] shadow-[0_12px_30px_rgba(188,98,255,0.28)]"
                      : "border-white/10 bg-white/5 text-[#efe5ff] hover:border-[#be86ff]/25 hover:bg-white/8"
                  )}
                >
                  <div className="text-sm font-semibold">{level}</div>
                  <div className={classNames("text-xs", difficulty === level ? "text-[#3c1644]" : "text-[#aea1bf]")}>
                    {info.clues} clues
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className={classNames("mt-6 grid gap-3 sm:grid-cols-2", settings.liveValidation ? "xl:grid-cols-5" : "xl:grid-cols-4")}>
            <MetricCard
              icon={<Grid3X3 className="h-4 w-4" />}
              label="Difficulty"
              value={difficulty}
              detail={`${DIFFICULTIES[difficulty].clues} clues`}
            />
            <MetricCard
              icon={<Clock3 className="h-4 w-4" />}
              label="Time"
              value={settings.timerEnabled ? formatTime(seconds) : "Off"}
              detail={settings.timerEnabled ? "Current board" : "Timer disabled"}
            />
            <MetricCard
              icon={<Trophy className="h-4 w-4" />}
              label="Best"
              value={bestTime ? formatTime(bestTime) : "--:--"}
              detail={`${difficulty} best`}
            />
            <MetricCard
              icon={<NotebookPen className="h-4 w-4" />}
              label="Progress"
              value={progressLabel}
              detail={`${81 - filledCount} open`}
            />
            {settings.liveValidation && (
              <MetricCard
                icon={<AlertTriangle className="h-4 w-4" />}
                label="Mistakes"
                value={String(mistakeCount)}
                detail={mistakeDetail}
              />
            )}
          </div>
        </MotionHeader>

        <div className="mt-8 grid gap-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <MotionSection
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-[2rem] border border-white/8 bg-[#0f0b16]/80 p-4 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl sm:p-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl text-[#fbf5ff] [font-family:var(--font-display)]">Board</h2>
                <p className="mt-1 text-sm text-[#c8bdd6]">
                  Click a square, use your keyboard, and tap <span className="font-semibold text-[#f3a3eb]">N</span> for notes.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <ModeButton active={!noteMode} onClick={() => setNoteMode(false)}>
                  Fill
                </ModeButton>
                <ModeButton active={noteMode} onClick={() => setNoteMode(true)}>
                  Notes
                </ModeButton>
                <UtilityButton
                  icon={<Lightbulb className="h-4 w-4" />}
                  label={hintLimit === 0 ? "Hints off" : `Hint ${hintsRemaining}`}
                  onClick={applyHint}
                  disabled={completed || hintsRemaining <= 0}
                />
                <UtilityButton
                  icon={<Eraser className="h-4 w-4" />}
                  label="Clear"
                  onClick={clearSelectedCell}
                  disabled={
                    completed ||
                    selected.r === null ||
                    selected.c === null ||
                    puzzleData.fixed[selected.r][selected.c]
                  }
                />
                {!showResetConfirm && (
                  <UtilityButton
                    icon={<RotateCcw className="h-4 w-4" />}
                    label="New board"
                    onClick={() => setShowResetConfirm(true)}
                    tone="warm"
                  />
                )}
              </div>
            </div>

            {showResetConfirm && (
              <div className="mt-5 rounded-[1.5rem] border border-[#f35e92]/25 bg-[#f35e92]/10 p-4 text-sm text-[#fde3ee]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Start a fresh {difficulty.toLowerCase()} board and clear the current progress?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="rounded-xl border border-white/10 bg-white/5 px-3 py-2 font-medium text-[#f6efff]"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={() => loadFreshPuzzle()}
                      className="rounded-xl bg-[linear-gradient(135deg,#ff8fe1_0%,#9c62ff_100%)] px-3 py-2 font-semibold text-[#1d0922]"
                    >
                      Confirm
                    </button>
                  </div>
                </div>
              </div>
            )}

            <div
              className={classNames(
                "mt-6 grid gap-4 xl:items-start",
                settings.remainingCounts ? "xl:grid-cols-[128px_minmax(0,1fr)]" : "xl:grid-cols-1"
              )}
            >
              {settings.remainingCounts && (
                <div className="rounded-[1.5rem] border border-white/8 bg-white/4 p-4 xl:sticky xl:top-6">
                  <div className="mb-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[#a999be]">Remaining</div>
                    <div className="mt-1 text-sm text-[#c8bdd6]">{completionPercent(filledCount)}% filled</div>
                  </div>
                  <div className="grid grid-cols-3 gap-2 sm:grid-cols-9 xl:grid-cols-1">
                    {range9.map((digit) => (
                      <CounterPill
                        key={digit}
                        digit={digit}
                        remaining={remaining[digit]}
                        selected={selectedValue === digit}
                      />
                    ))}
                  </div>
                </div>
              )}

              <div className="rounded-[2rem] border border-[#d8c1ff]/14 bg-[#120d18] p-4 sm:p-5">
                <div className="mx-auto aspect-square max-w-[760px] rounded-[1.4rem] bg-[linear-gradient(180deg,#2c2334_0%,#17121f_100%)] p-2 shadow-[0_24px_50px_rgba(8,10,12,0.38)]">
                  <div className="grid h-full grid-cols-9 grid-rows-9 overflow-hidden rounded-[1rem] bg-[#483b57]">
                    {board.map((row, r) =>
                      row.map((value, c) => {
                        const fixed = puzzleData.fixed[r][c];
                        const isSelected = selected.r === r && selected.c === c;
                        const sameRow = settings.focusAura && selected.r === r;
                        const sameCol = settings.focusAura && selected.c === c;
                        const sameBox =
                          settings.focusAura &&
                          selected.r !== null &&
                          getBoxIndex(selected.r, selected.c) === getBoxIndex(r, c);
                        const sameNumber = settings.focusAura && selectedValue && value !== 0 && value === selectedValue;
                        const key = `${r}-${c}`;
                        const feedbackType = feedbackCells[key];
                        const correctPulse = feedbackType === "correct";
                        const wrongPulse = feedbackType === "wrong";
                        const wrong = settings.liveValidation && !fixed && value !== 0 && value !== puzzleData.solution[r][c];
                        const noteValues = notes[r][c];
                        let backgroundColor = fixed ? "#ece4f3" : "#faf4ff";
                        let textColor = fixed ? "#211927" : "#6170ff";
                        const shadowLayers = [];

                        if (sameRow || sameCol) {
                          backgroundColor = "#ddd5e6";
                        }

                        if (sameBox) {
                          backgroundColor = "#cdc4d8";
                        }

                        if (sameNumber) {
                          backgroundColor = "#f3b9fb";
                          textColor = "#54205f";
                          shadowLayers.push("inset 0 0 0 1px rgba(150,70,175,0.28)");
                        }

                        if (correctPulse) {
                          backgroundColor = "#ecd9ff";
                          shadowLayers.push("inset 0 0 0 2px rgba(165,108,255,0.5)");
                        }

                        if (wrong) {
                          backgroundColor = "#f7d8e3";
                          textColor = "#a53662";
                          shadowLayers.push("inset 0 0 0 2px rgba(245,96,145,0.35)");
                        }

                        if (isSelected) {
                          shadowLayers.push("inset 0 0 0 2px rgba(242,124,225,0.88)");
                        }

                        const cellBorderStyle = {
                          borderStyle: "solid",
                          borderColor: "#483b57",
                          borderTopWidth: r % 3 === 0 ? 3 : 1,
                          borderLeftWidth: c % 3 === 0 ? 3 : 1,
                          borderRightWidth: c === 8 ? 3 : 0,
                          borderBottomWidth: r === 8 ? 3 : 0,
                          backgroundColor,
                          color: textColor,
                          boxShadow: shadowLayers.join(", "),
                          zIndex: isSelected ? 1 : 0,
                        };

                        return (
                          <MotionButton
                            key={key}
                            type="button"
                            whileTap={{ scale: 0.985 }}
                            animate={
                              wrongPulse
                                ? { x: [0, -5, 5, -4, 4, 0], scale: [1, 1.02, 1], transition: { duration: 0.34 } }
                                : correctPulse
                                  ? { scale: [1, 1.08, 1], transition: { duration: 0.3 } }
                                  : { x: 0, scale: 1 }
                            }
                            onClick={() => setSelected({ r, c })}
                            style={cellBorderStyle}
                            className={classNames(
                              "relative flex aspect-square min-w-0 items-center justify-center border-solid text-[1.05rem] font-bold leading-none outline-none transition-[background-color,color,box-shadow] duration-150 sm:text-[1.65rem]",
                              isSelected && "z-10"
                            )}
                          >
                            {correctPulse && (
                              <motion.span
                                initial={{ opacity: 0.75, scale: 0.8 }}
                                animate={{ opacity: 0, scale: 1.15 }}
                                transition={{ duration: 0.45 }}
                                className="absolute inset-[10%] rounded-[0.7rem] border border-[#b57cff]"
                              />
                            )}
                            {wrongPulse && (
                              <motion.span
                                initial={{ opacity: 0.7, scale: 0.94 }}
                                animate={{ opacity: 0, scale: 1.08 }}
                                transition={{ duration: 0.32 }}
                                className="absolute inset-[10%] rounded-[0.7rem] border-2 border-[#f35e92]"
                              />
                            )}

                            {value === 0 ? (
                              noteValues.length > 0 ? (
                                <span className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0 p-1.5 text-[0.54rem] font-semibold leading-none text-[#7c6f8d] sm:text-[0.7rem]">
                                  {range9.map((digit) => (
                                    <span
                                      key={digit}
                                      className="flex items-center justify-center"
                                    >
                                      {noteValues.includes(digit) ? digit : ""}
                                    </span>
                                  ))}
                                </span>
                              ) : null
                            ) : (
                              <span className="font-bold drop-shadow-[0_1px_0_rgba(255,255,255,0.25)]">
                                {value}
                              </span>
                            )}
                          </MotionButton>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          </MotionSection>

          <MotionAside
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.08 }}
            className="space-y-6"
          >
            <PanelCard icon={<Save className="h-5 w-5 text-[#f3a3eb]" />} title="Session">
              <div className="space-y-3">
                <InlineStat label="Difficulty" value={difficulty} />
                <InlineStat label="Selected" value={selectedLabel} />
                <InlineStat label="Mode" value={noteMode ? "Notes" : "Fill"} />
                <InlineStat label="Hints left" value={String(hintsRemaining)} />
                <InlineStat label="Open cells" value={String(81 - filledCount)} />
                <InlineStat label="Best time" value={bestTime ? formatTime(bestTime) : "--:--"} />
                {settings.liveValidation && <InlineStat label="Mistakes" value={String(mistakeCount)} />}
              </div>
              <p className="mt-4 text-sm leading-6 text-[#c8bdd6]">
                Settings and best times stay on this device.
              </p>
            </PanelCard>

            <PanelCard icon={<Settings className="h-5 w-5 text-[#c391ff]" />} title="Settings">
              <div className="space-y-3">
                {SETTINGS_LIST.map((item) => (
                  <ToggleRow
                    key={item.key}
                    label={item.label}
                    description={item.description}
                    enabled={settings[item.key]}
                    onToggle={() =>
                      setSettings((current) => ({
                        ...current,
                        [item.key]: !current[item.key],
                      }))
                    }
                  />
                ))}
              </div>
            </PanelCard>

            <PanelCard icon={<Trophy className="h-5 w-5 text-[#f3a3eb]" />} title="Best Times">
              <div className="space-y-2">
                {Object.keys(DIFFICULTIES).map((level) => (
                  <BestTimeRow key={level} level={level} value={bestTimes[level]} active={difficulty === level} />
                ))}
              </div>
            </PanelCard>

            <AnimatePresence>
              {completed && (
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.99 }}
                  className="rounded-[2rem] border border-[#bc6cff]/25 bg-[#bc6cff]/12 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.25)]"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-[#efdcff]" />
                    <h2 className="text-2xl text-[#f8eeff] [font-family:var(--font-display)]">Solved</h2>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[#ead7ff]">{winMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </MotionAside>
        </div>
      </div>
    </div>
  );
}

function completionPercent(filledCount) {
  return Math.round((filledCount / 81) * 100);
}

function MetricCard({ icon, label, value, detail }) {
  return (
    <div className="rounded-[1.4rem] border border-white/8 bg-white/4 p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[#b59dcc]">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl text-[#fbf5ff] [font-family:var(--font-display)]">{value}</div>
      <div className="mt-1 text-sm text-[#c8bdd6]">{detail}</div>
    </div>
  );
}

function PanelCard({ icon, title, children }) {
  return (
    <div className="rounded-[2rem] border border-white/8 bg-[#0f0b16]/80 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.34)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        {icon}
        <h2 className="text-2xl text-[#fbf5ff] [font-family:var(--font-display)]">{title}</h2>
      </div>
      {children}
    </div>
  );
}

function ToggleRow({ label, description, enabled, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-white/8 bg-white/4 px-4 py-4 text-left transition-all duration-200 hover:bg-white/7"
    >
      <div>
        <div className="font-semibold text-[#f6efff]">{label}</div>
        <div className="mt-1 text-sm leading-6 text-[#c8bdd6]">{description}</div>
      </div>
      <span
        className={classNames(
          "relative block h-7 w-12 shrink-0 rounded-full transition-all duration-200",
          enabled ? "bg-[linear-gradient(135deg,#ff8fe1_0%,#9c62ff_100%)]" : "bg-white/10"
        )}
      >
        <span
          className={classNames(
            "absolute top-1 block h-5 w-5 rounded-full bg-white transition-all duration-200",
            enabled ? "left-6" : "left-1"
          )}
        />
      </span>
    </button>
  );
}

function UtilityButton({ icon, label, onClick, disabled = false, tone = "default", fullWidth = false }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        "inline-flex items-center justify-center gap-2 rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-40",
        fullWidth && "flex w-full",
        tone === "warm"
          ? "border-[#f08be8]/25 bg-[#f08be8]/12 text-[#ffd7fb] hover:bg-[#f08be8]/18"
          : "border-white/10 bg-white/5 text-[#f6efff] hover:border-[#c98cff]/25 hover:bg-white/10"
      )}
    >
      {icon}
      {label}
    </button>
  );
}

function ModeButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-full border px-4 py-2.5 text-sm font-semibold transition-all duration-200",
        active
          ? "border-[#bc6cff]/40 bg-[#bc6cff] text-[#19091e]"
          : "border-white/10 bg-white/5 text-[#ddcff2] hover:border-[#bc6cff]/25 hover:bg-white/10"
      )}
    >
      {children}
    </button>
  );
}

function CounterPill({ digit, remaining, selected }) {
  const helperTextClass = remaining === 0 ? "text-[#f0d0ff]" : selected ? "text-[#ffd4fa]" : "text-[#c8bdd6]";

  return (
    <div
      className={classNames(
        "flex min-w-0 flex-col items-center justify-center rounded-[1rem] border px-2 py-3 text-center transition-all duration-200",
        remaining === 0
          ? "border-[#bc6cff]/30 bg-[#bc6cff]/12 text-[#f4e3ff]"
          : "border-white/8 bg-[#18131f] text-[#f6efff]",
        selected && remaining !== 0 && "border-[#f08be8]/35 bg-[#f08be8]/12 text-[#ffd9fb]"
      )}
    >
      <div className="text-lg font-bold leading-none">{digit}</div>
      <div className={classNames("mt-1 text-[12px] font-medium leading-none", helperTextClass)}>
        {remaining} left
      </div>
    </div>
  );
}

function InlineStat({ label, value }) {
  return (
    <div className="flex items-center justify-between rounded-[1rem] border border-white/6 bg-black/12 px-3 py-2.5">
      <span className="text-sm text-[#ae9fc2]">{label}</span>
      <span className="text-sm font-semibold text-[#f6efff]">{value}</span>
    </div>
  );
}

function BestTimeRow({ level, value, active }) {
  return (
    <div
      className={classNames(
        "flex items-center justify-between rounded-[1rem] border px-4 py-3",
        active ? "border-[#f08be8]/25 bg-[#f08be8]/10" : "border-white/8 bg-white/4"
      )}
    >
      <span className="font-semibold text-[#f6efff]">{level}</span>
      <span className="text-sm text-[#c8bdd6]">{value ? formatTime(value) : "--:--"}</span>
    </div>
  );
}
