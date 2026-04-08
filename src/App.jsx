import React, { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import wizardLogo from "../sw_logo.png";
import {
  AlertTriangle,
  Archive,
  ChevronDown,
  CheckCircle2,
  CircleUserRound,
  Clock3,
  Crown,
  Eraser,
  Gem,
  Grid3X3,
  Lightbulb,
  LoaderCircle,
  LockKeyhole,
  LogOut,
  Mail,
  Moon,
  NotebookPen,
  PlayCircle,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Star,
  Sun,
  Trash2,
  Trophy,
  User,
  WandSparkles,
  X,
} from "lucide-react";
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { deleteField, doc, onSnapshot, serverTimestamp, setDoc, updateDoc } from "firebase/firestore";
import { auth, db, firebaseReady } from "./firebase";

const MotionHeader = motion.header;
const MotionSection = motion.section;
const MotionAside = motion.aside;
const MotionButton = motion.button;

const MAX_ARCHIVES = 9;

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
  lightMode: false,
};

const SETTINGS_STORAGE_KEY = "sudoku-wizard-settings";

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
  {
    key: "lightMode",
    label: "Light mode",
    description: "Swap the site between dark and light.",
  },
];

const AVATARS = [
  { id: "spark", label: "Spark", icon: Sparkles, gradient: "from-[#ff8fe1] to-[#9c62ff]" },
  { id: "wand", label: "Wand", icon: WandSparkles, gradient: "from-[#ffb3ef] to-[#7c4dff]" },
  { id: "crown", label: "Crown", icon: Crown, gradient: "from-[#f35e92] to-[#bc6cff]" },
  { id: "gem", label: "Gem", icon: Gem, gradient: "from-[#c391ff] to-[#ff74d9]" },
  { id: "star", label: "Star", icon: Star, gradient: "from-[#f08be8] to-[#5f45c8]" },
  { id: "grid", label: "Grid", icon: Grid3X3, gradient: "from-[#7d6cff] to-[#ff8eb7]" },
];

const DEFAULT_AVATAR_ID = AVATARS[0].id;

const DARK_THEME = {
  "--sw-panel": "rgba(15, 11, 22, 0.82)",
  "--sw-panel-strong": "rgba(11, 7, 16, 0.94)",
  "--sw-panel-soft": "rgba(255, 255, 255, 0.04)",
  "--sw-panel-hover": "rgba(255, 255, 255, 0.08)",
  "--sw-border": "rgba(255, 255, 255, 0.1)",
  "--sw-border-soft": "rgba(255, 255, 255, 0.08)",
  "--sw-title": "#fbf5ff",
  "--sw-text": "#f6efff",
  "--sw-muted": "#c8bdd6",
  "--sw-muted-strong": "#a999be",
  "--sw-complete-text": "#f4e3ff",
  "--sw-shadow": "0 24px 90px rgba(0, 0, 0, 0.36)",
  "--sw-shadow-tight": "0 16px 40px rgba(0, 0, 0, 0.28)",
  "--sw-board-card": "#120d18",
  "--sw-board-frame": "#483b57",
};

const LIGHT_THEME = {
  "--sw-panel": "rgba(255, 250, 255, 0.78)",
  "--sw-panel-strong": "rgba(255, 253, 255, 0.94)",
  "--sw-panel-soft": "rgba(255, 255, 255, 0.62)",
  "--sw-panel-hover": "rgba(247, 219, 255, 0.78)",
  "--sw-border": "rgba(98, 55, 117, 0.18)",
  "--sw-border-soft": "rgba(98, 55, 117, 0.12)",
  "--sw-title": "#26142f",
  "--sw-text": "#302139",
  "--sw-muted": "#6d5d78",
  "--sw-muted-strong": "#7c5d91",
  "--sw-complete-text": "#5f2175",
  "--sw-shadow": "0 28px 90px rgba(125, 79, 144, 0.2)",
  "--sw-shadow-tight": "0 18px 45px rgba(124, 83, 150, 0.2)",
  "--sw-board-card": "rgba(255, 250, 255, 0.76)",
  "--sw-board-frame": "#6f5d7b",
};

const DARK_BOARD_COLORS = {
  fixed: "#ece4f3",
  open: "#faf4ff",
  rowCol: "#c8bdd4",
  box: "#b5a6c4",
  match: "#f0a7f6",
  userText: "#6170ff",
  fixedText: "#211927",
  matchText: "#4a1856",
  border: "#483b57",
  correct: "#ecd9ff",
  wrong: "#f7d8e3",
  wrongText: "#a53662",
  noteText: "#7c6f8d",
};

const LIGHT_BOARD_COLORS = {
  fixed: "#f1e8f8",
  open: "#fff9ff",
  rowCol: "#d5c2df",
  box: "#c1a8d0",
  match: "#ee9bef",
  userText: "#3344c9",
  fixedText: "#271b2e",
  matchText: "#4a164e",
  border: "#655272",
  correct: "#e8d5ff",
  wrong: "#f8d2e0",
  wrongText: "#a02d58",
  noteText: "#7d6688",
};

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

function formatArchiveName(date) {
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function createArchiveId() {
  return window.crypto?.randomUUID?.() ?? `archive-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDefaultProfile(email = "") {
  return {
    email,
    avatarId: DEFAULT_AVATAR_ID,
    settings: DEFAULT_SETTINGS,
    bestTimes: {},
    gamesCompleted: 0,
    archives: [],
  };
}

function normalizeProfile(data, user) {
  const profile = createDefaultProfile(user?.email ?? "");
  const avatarExists = AVATARS.some((avatar) => avatar.id === data?.avatarId);
  const archiveValues = [
    ...Object.values(data?.archivesById ?? {}),
    ...(Array.isArray(data?.archives) ? data.archives : []),
  ];
  const archiveIds = new Set();

  return {
    email: data?.email ?? profile.email,
    avatarId: avatarExists ? data.avatarId : profile.avatarId,
    settings: { ...DEFAULT_SETTINGS, ...(data?.settings ?? {}) },
    bestTimes: data?.bestTimes && typeof data.bestTimes === "object" ? data.bestTimes : {},
    gamesCompleted: Number.isFinite(data?.gamesCompleted) ? data.gamesCompleted : 0,
    archives: archiveValues
      .map(deserializeArchive)
      .filter((archive) => {
        if (!archive || archiveIds.has(archive.id)) return false;
        archiveIds.add(archive.id);
        return true;
      })
      .slice(0, MAX_ARCHIVES),
  };
}

function encodeNumberGrid(grid) {
  return grid.map((row) => row.join(""));
}

function decodeNumberGrid(rows) {
  return rows.map((row) => String(row).padEnd(9, "0").slice(0, 9).split("").map(Number));
}

function encodeBooleanGrid(grid) {
  return grid.map((row) => row.map((value) => (value ? "1" : "0")).join(""));
}

function decodeBooleanGrid(rows) {
  return rows.map((row) => String(row).padEnd(9, "0").slice(0, 9).split("").map((value) => value === "1"));
}

function encodeNotesGrid(notes) {
  return notes.flatMap((row) => row.map((cell) => cell.join("")));
}

function decodeNotesGrid(cells) {
  return Array.from({ length: 9 }, (_, r) =>
    Array.from({ length: 9 }, (_, c) =>
      String(cells[r * 9 + c] ?? "")
        .split("")
        .map(Number)
        .filter((value) => value >= 1 && value <= 9)
    )
  );
}

function serializeArchive(archive) {
  return {
    id: archive.id,
    name: archive.name,
    archivedAt: archive.archivedAt,
    difficulty: archive.difficulty,
    puzzleRows: encodeNumberGrid(archive.puzzleData.puzzle),
    solutionRows: encodeNumberGrid(archive.puzzleData.solution),
    fixedRows: encodeBooleanGrid(archive.puzzleData.fixed),
    boardRows: encodeNumberGrid(archive.board),
    noteCells: encodeNotesGrid(archive.notes),
    seconds: archive.seconds,
    mistakeCount: archive.mistakeCount,
    hintCount: archive.hintCount,
    noteMode: archive.noteMode,
  };
}

function deserializeArchive(archive) {
  if (!archive?.id) return null;

  const puzzleRows = archive.puzzleRows ?? archive.puzzleData?.puzzle;
  const solutionRows = archive.solutionRows ?? archive.puzzleData?.solution;
  const fixedRows = archive.fixedRows ?? archive.puzzleData?.fixed;
  const boardRows = archive.boardRows ?? archive.board;
  const noteCells = archive.noteCells ?? archive.notes;

  if (!puzzleRows || !solutionRows || !fixedRows || !boardRows) return null;

  return {
    id: archive.id,
    name: archive.name ?? "Archived puzzle",
    archivedAt: archive.archivedAt ?? new Date().toISOString(),
    difficulty: archive.difficulty ?? "Easy",
    puzzleData: {
      puzzle: Array.isArray(puzzleRows[0]) ? puzzleRows : decodeNumberGrid(puzzleRows),
      solution: Array.isArray(solutionRows[0]) ? solutionRows : decodeNumberGrid(solutionRows),
      fixed: Array.isArray(fixedRows[0]) ? fixedRows : decodeBooleanGrid(fixedRows),
    },
    board: Array.isArray(boardRows[0]) ? boardRows : decodeNumberGrid(boardRows),
    notes: Array.isArray(noteCells?.[0]) ? noteCells : decodeNotesGrid(noteCells ?? []),
    seconds: archive.seconds ?? 0,
    mistakeCount: archive.mistakeCount ?? 0,
    hintCount: archive.hintCount ?? 0,
    noteMode: Boolean(archive.noteMode),
  };
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

function authErrorMessage(error) {
  if (error?.code === "auth/configuration-not-found" || error?.message?.includes("CONFIGURATION_NOT_FOUND")) {
    return "Firebase Authentication is not enabled for this project yet. Enable Authentication and the Email/Password provider in Firebase Console.";
  }

  if (error?.code === "auth/operation-not-allowed") {
    return "Email/password sign-in is not enabled yet in Firebase Authentication.";
  }

  return error?.message ?? "Something went wrong.";
}

export default function SudokuWizard() {
  const [accountMode, setAccountMode] = useState(firebaseReady ? "loading" : "gate");
  const [authUser, setAuthUser] = useState(null);
  const legacyArchivesMigrated = useRef(false);
  const [profileLoaded, setProfileLoaded] = useState(!firebaseReady);
  const [accountMessage, setAccountMessage] = useState(firebaseReady ? "" : "Firebase is not configured yet.");
  const [profileOpen, setProfileOpen] = useState(false);
  const [profileTab, setProfileTab] = useState("scores");
  const [profile, setProfile] = useState(createDefaultProfile);
  const [difficulty, setDifficulty] = useState("Easy");
  const [settings, setSettings] = useState(readStoredSettings);
  const [bestTimes, setBestTimes] = useState({});
  const [gamesCompleted, setGamesCompleted] = useState(0);
  const [archives, setArchives] = useState([]);
  const [puzzleData, setPuzzleData] = useState(() => generatePuzzle("Easy"));
  const [seconds, setSeconds] = useState(0);
  const [selected, setSelected] = useState({ r: null, c: null });
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [feedbackCells, setFeedbackCells] = useState({});
  const [mistakeCount, setMistakeCount] = useState(0);
  const [noteMode, setNoteMode] = useState(false);
  const [hintCount, setHintCount] = useState(0);
  const [timerLocked, setTimerLocked] = useState(false);
  const [archivedPuzzleId, setArchivedPuzzleId] = useState(null);
  const [completionRecorded, setCompletionRecorded] = useState(false);
  const [archiveSaving, setArchiveSaving] = useState(false);
  const [board, setBoard] = useState(puzzleData.puzzle);
  const [notes, setNotes] = useState(createEmptyNotes);

  const remaining = useMemo(() => countRemaining(board, puzzleData.solution), [board, puzzleData.solution]);
  const filledCount = useMemo(
    () => board.reduce((count, row) => count + row.filter((value) => value !== 0).length, 0),
    [board]
  );
  const completed = useMemo(() => isSolvedBoard(board, puzzleData.solution), [board, puzzleData.solution]);
  const isSignedIn = accountMode === "user" && Boolean(authUser);
  const activeAvatar = AVATARS.find((avatar) => avatar.id === profile.avatarId) ?? AVATARS[0];
  const ActiveAvatarIcon = activeAvatar.icon;
  const timerIsRunning = settings.timerEnabled && !timerLocked && !completed;
  const themeVars = settings.lightMode ? LIGHT_THEME : DARK_THEME;
  const boardColors = settings.lightMode ? LIGHT_BOARD_COLORS : DARK_BOARD_COLORS;
  const pageStyle = {
    ...themeVars,
    background: settings.lightMode
      ? "radial-gradient(circle at 12% -10%, rgba(255, 147, 228, 0.52) 0%, transparent 34%), radial-gradient(circle at 88% 8%, rgba(156, 98, 255, 0.34) 0%, transparent 32%), linear-gradient(135deg, #fff6fd 0%, #eee8f5 48%, #d6d1dc 100%)"
      : "radial-gradient(circle at top left, #3a1245 0%, #17081f 45%, #050507 100%)",
    color: "var(--sw-text)",
  };

  useEffect(() => {
    if (!timerIsRunning) return undefined;

    const interval = window.setInterval(() => setSeconds((current) => current + 1), 1000);
    return () => window.clearInterval(interval);
  }, [timerIsRunning]);

  useEffect(() => {
    if (!firebaseReady || !auth) return undefined;

    return onAuthStateChanged(auth, (user) => {
      legacyArchivesMigrated.current = false;
      setAuthUser(user);

      if (user) {
        setAccountMode("user");
        setAccountMessage("");
        setProfileLoaded(false);
        return;
      }

      setProfile(createDefaultProfile());
      setBestTimes({});
      setGamesCompleted(0);
      setArchives([]);
      setProfileLoaded(true);
      setAccountMode((current) => (current === "guest" ? "guest" : "gate"));
    });
  }, []);

  useEffect(() => {
    if (!authUser || !db) return undefined;

    const profileRef = doc(db, "users", authUser.uid);
    setDoc(
      profileRef,
      {
        email: authUser.email ?? "",
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    ).catch((error) => setAccountMessage(authErrorMessage(error)));

    return onSnapshot(
      profileRef,
      { includeMetadataChanges: true },
      (snapshot) => {
        const snapshotData = snapshot.data();
        const nextProfile = normalizeProfile(snapshotData, authUser);
        if (!snapshot.metadata.fromCache) setProfileLoaded(true);
        setProfile(nextProfile);
        setSettings(nextProfile.settings);
        setBestTimes(nextProfile.bestTimes);
        setGamesCompleted(nextProfile.gamesCompleted);
        setArchives(nextProfile.archives);

        if (!legacyArchivesMigrated.current && Array.isArray(snapshotData?.archives) && snapshotData.archives.length > 0) {
          legacyArchivesMigrated.current = true;
          const archivePatch = Object.fromEntries(
            nextProfile.archives.map((archive) => [`archivesById.${archive.id}`, serializeArchive(archive)])
          );
          updateDoc(profileRef, {
            ...archivePatch,
            archives: deleteField(),
            updatedAt: serverTimestamp(),
          }).catch((error) => setAccountMessage(authErrorMessage(error)));
        }
      },
      (error) => setAccountMessage(authErrorMessage(error))
    );
  }, [authUser]);

  useEffect(() => {
    window.localStorage.setItem(SETTINGS_STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const selectedValue = selected.r !== null && selected.c !== null ? board[selected.r][selected.c] : null;
  const hintLimit = DIFFICULTIES[difficulty].hints;
  const hintsRemaining = Math.max(0, hintLimit - hintCount);
  const progressLabel = `${filledCount}/81`;
  const mistakeDetail = mistakeCount === 0 ? "Clean run so far" : `${mistakeCount} total this board`;
  const timeDetail = timerLocked ? "Archived, no best time" : settings.timerEnabled ? "Current board" : "Timer disabled";
  const selectedLabel =
    selected.r !== null && selected.c !== null ? `R${selected.r + 1} C${selected.c + 1}` : "None";
  const winMessage = completed
    ? `Solved${settings.timerEnabled && !timerLocked ? ` in ${formatTime(seconds)}` : ""}${timerLocked ? ", not eligible for a best time" : ""}${hintCount ? ` with ${hintCount} hint${hintCount === 1 ? "" : "s"}` : ""}.`
    : null;

  async function saveProfilePatch(patch) {
    if (!authUser || !db) return false;

    try {
      await setDoc(
        doc(db, "users", authUser.uid),
        {
          ...patch,
          email: authUser.email ?? profile.email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      return true;
    } catch (error) {
      setAccountMessage(authErrorMessage(error));
      return false;
    }
  }

  async function saveArchive(archive) {
    if (!authUser || !db) return false;

    try {
      const profileRef = doc(db, "users", authUser.uid);
      await setDoc(
        profileRef,
        {
          email: authUser.email ?? profile.email,
          updatedAt: serverTimestamp(),
        },
        { merge: true }
      );
      await updateDoc(profileRef, {
        [`archivesById.${archive.id}`]: serializeArchive(archive),
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      setAccountMessage(authErrorMessage(error));
      return false;
    }
  }

  async function removeArchive(archiveId) {
    if (!authUser || !db) return false;

    try {
      await updateDoc(doc(db, "users", authUser.uid), {
        [`archivesById.${archiveId}`]: deleteField(),
        updatedAt: serverTimestamp(),
      });
      return true;
    } catch (error) {
      setAccountMessage(authErrorMessage(error));
      return false;
    }
  }

  function commitSettings(updater) {
    setSettings((current) => {
      const next = typeof updater === "function" ? updater(current) : updater;
      if (isSignedIn) void saveProfilePatch({ settings: next });
      return next;
    });
  }

  function updateAvatar(avatarId) {
    setProfile((current) => ({ ...current, avatarId }));
    if (isSignedIn) void saveProfilePatch({ avatarId });
  }

  async function handleSignIn(email, password) {
    setAccountMessage("");
    if (!firebaseReady || !auth) throw new Error("Firebase is not configured yet.");
    await signInWithEmailAndPassword(auth, email, password);
  }

  async function handleSignUp(email, password) {
    setAccountMessage("");
    if (!firebaseReady || !auth || !db) throw new Error("Firebase is not configured yet.");
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(
      doc(db, "users", credential.user.uid),
      {
        email: credential.user.email ?? email,
        avatarId: DEFAULT_AVATAR_ID,
        settings,
        bestTimes: {},
        gamesCompleted: 0,
        archivesById: {},
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  }

  async function handlePasswordReset(email) {
    setAccountMessage("");
    if (!firebaseReady || !auth) throw new Error("Firebase is not configured yet.");
    await sendPasswordResetEmail(auth, email);
    setAccountMessage("Password reset email sent.");
  }

  async function handleLogout() {
    if (!auth) return;
    await signOut(auth);
    setProfileOpen(false);
    setAccountMode("gate");
  }

  function continueAsGuest() {
    setAccountMode("guest");
    setAccountMessage("");
    setSettings(readStoredSettings());
    setBestTimes({});
    setGamesCompleted(0);
    setArchives([]);
  }

  function recordSolvedBoard(nextBoard) {
    if (!isSolvedBoard(nextBoard, puzzleData.solution) || completionRecorded) return;

    setCompletionRecorded(true);

    if (!isSignedIn) return;

    const nextGamesCompleted = gamesCompleted + 1;
    const patch = { gamesCompleted: nextGamesCompleted };
    setGamesCompleted(nextGamesCompleted);

    if (!timerLocked && settings.timerEnabled) {
      const existing = bestTimes[difficulty];
      if (!existing || seconds < existing) {
        const nextBestTimes = { ...bestTimes, [difficulty]: seconds };
        patch.bestTimes = nextBestTimes;
        setBestTimes(nextBestTimes);
      }
    }

    if (archivedPuzzleId) {
      const nextArchives = archives.filter((archive) => archive.id !== archivedPuzzleId);
      setArchives(nextArchives);
      void removeArchive(archivedPuzzleId);
      setArchivedPuzzleId(null);
    }

    void saveProfilePatch(patch);
  }

  function createArchiveSnapshot(id, name) {
    return {
      id,
      name,
      archivedAt: new Date().toISOString(),
      difficulty,
      puzzleData,
      board,
      notes,
      seconds,
      mistakeCount,
      hintCount,
      noteMode,
    };
  }

  async function archiveCurrentPuzzle() {
    if (!isSignedIn || completed || archiveSaving) return;

    const existingArchive = archives.find((archive) => archive.id === archivedPuzzleId);
    if (!existingArchive && archives.length >= MAX_ARCHIVES) {
      setAccountMessage("Archive limit reached. Delete one before saving another puzzle.");
      setProfileOpen(true);
      setProfileTab("archives");
      return;
    }

    const id = existingArchive?.id ?? createArchiveId();
    const name = existingArchive?.name ?? formatArchiveName(new Date());
    const snapshot = createArchiveSnapshot(id, name);
    const nextArchives = existingArchive
      ? archives.map((archive) => (archive.id === id ? snapshot : archive))
      : [snapshot, ...archives].slice(0, MAX_ARCHIVES);

    setArchiveSaving(true);
    setAccountMessage("");

    const saved = await saveArchive(snapshot);

    if (saved) {
      setArchives(nextArchives);
      setArchivedPuzzleId(id);
      setTimerLocked(true);
      setAccountMessage("Puzzle archived. Timer and best-time eligibility are off for this board.");
    } else {
      setProfileOpen(true);
      setProfileTab("archives");
    }

    setArchiveSaving(false);
  }

  function loadArchivedPuzzle(archive) {
    setDifficulty(archive.difficulty);
    setPuzzleData(archive.puzzleData);
    setBoard(archive.board);
    setNotes(archive.notes ?? createEmptyNotes());
    setSelected({ r: null, c: null });
    setSeconds(archive.seconds ?? 0);
    setFeedbackCells({});
    setMistakeCount(archive.mistakeCount ?? 0);
    setNoteMode(Boolean(archive.noteMode));
    setHintCount(archive.hintCount ?? 0);
    setShowResetConfirm(false);
    setTimerLocked(true);
    setArchivedPuzzleId(archive.id);
    setCompletionRecorded(false);
    setProfileOpen(false);
  }

  async function deleteArchivedPuzzle(archiveId) {
    if (archiveSaving) return;

    const nextArchives = archives.filter((archive) => archive.id !== archiveId);
    setArchiveSaving(true);
    const saved = isSignedIn ? await removeArchive(archiveId) : true;

    if (saved) {
      setArchives(nextArchives);
      if (archivedPuzzleId === archiveId) setArchivedPuzzleId(null);
    } else {
      setProfileOpen(true);
      setProfileTab("archives");
    }

    setArchiveSaving(false);
  }

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
    recordSolvedBoard(nextBoard);

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
    recordSolvedBoard(nextBoard);

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
    setTimerLocked(false);
    setArchivedPuzzleId(null);
    setCompletionRecorded(false);
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

  if (accountMode === "loading") {
    return <AccountGate loading message="Checking your account..." />;
  }

  if (accountMode === "gate") {
    return (
      <AccountGate
        message={accountMessage}
        onSignIn={handleSignIn}
        onSignUp={handleSignUp}
        onResetPassword={handlePasswordReset}
        onGuest={continueAsGuest}
      />
    );
  }

  return (
    <div
      style={pageStyle}
      className="min-h-screen overflow-hidden transition-colors duration-500"
    >
      <div className="pointer-events-none absolute inset-0 opacity-80">
        <div className="absolute -left-12 top-0 h-72 w-72 rounded-full bg-[#ff74d9]/22 blur-3xl" />
        <div className="absolute right-0 top-40 h-80 w-80 rounded-full bg-[#8d5bff]/18 blur-3xl" />
        <div className={classNames("absolute bottom-0 left-1/3 h-72 w-72 rounded-full blur-3xl", settings.lightMode ? "bg-[#2b2433]/10" : "bg-[#9590a8]/10")} />
        {settings.lightMode && (
          <div className="absolute inset-x-0 top-0 h-64 bg-[linear-gradient(180deg,rgba(255,255,255,0.65)_0%,transparent_100%)]" />
        )}
      </div>

      <div className="relative mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <MotionHeader
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-[2rem] border border-[var(--sw-border)] bg-[var(--sw-panel)] p-6 shadow-[var(--sw-shadow)] backdrop-blur-xl"
        >
          <div className="flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-[1.6rem] border border-[var(--sw-border)] bg-[var(--sw-panel-soft)] p-2 shadow-[var(--sw-shadow-tight)]">
                <img src={wizardLogo} alt="Sudoku Wizard logo" className="h-20 w-auto sm:h-24" />
              </div>
              <div>
                <h1 className="text-4xl tracking-tight text-[var(--sw-title)] sm:text-5xl [font-family:var(--font-display)]">
                  Sudoku Wizard
                </h1>
              </div>
            </div>

            <div className="flex flex-col gap-4 xl:items-end">
              <button
                type="button"
                onClick={() => setProfileOpen(true)}
                className="inline-flex items-center gap-3 self-start rounded-full border border-[var(--sw-border)] bg-[var(--sw-panel-soft)] p-2 pr-4 text-sm font-semibold text-[var(--sw-title)] shadow-[var(--sw-shadow-tight)] transition-all duration-200 hover:border-[#f08be8]/35 hover:bg-[var(--sw-panel-hover)] xl:self-end"
              >
                <span className={classNames("flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br", activeAvatar.gradient)}>
                  <ActiveAvatarIcon className="h-6 w-6 text-white" />
                </span>
                <span>{isSignedIn ? "Profile" : "Guest"}</span>
                <ChevronDown className="h-4 w-4 text-[var(--sw-muted)]" />
              </button>

              <div className="flex flex-wrap gap-2 xl:justify-end">
                {Object.entries(DIFFICULTIES).map(([level, info]) => (
                  <button
                    key={level}
                    type="button"
                    onClick={() => loadFreshPuzzle(level)}
                    className={classNames(
                      "rounded-full border px-4 py-2.5 text-left transition-all duration-200",
                      difficulty === level
                        ? "border-[#ff93e4]/40 bg-[linear-gradient(135deg,#ff8fe1_0%,#9c62ff_100%)] text-[#1d0922] shadow-[0_12px_30px_rgba(188,98,255,0.28)]"
                        : "border-[var(--sw-border)] bg-[var(--sw-panel-soft)] text-[var(--sw-text)] hover:border-[#be86ff]/35 hover:bg-[var(--sw-panel-hover)]"
                    )}
                  >
                    <div className="text-sm font-semibold">{level}</div>
                    <div className={classNames("text-xs", difficulty === level ? "text-[#3c1644]" : "text-[var(--sw-muted)]")}>
                      {info.clues} clues
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className={classNames("mt-6 grid gap-3 sm:grid-cols-2", settings.liveValidation ? "xl:grid-cols-4" : "xl:grid-cols-3")}>
            <MetricCard
              icon={<Grid3X3 className="h-4 w-4" />}
              label="Difficulty"
              value={difficulty}
              detail={`${DIFFICULTIES[difficulty].clues} clues`}
            />
            <MetricCard
              icon={<Clock3 className="h-4 w-4" />}
              label="Time"
              value={timerLocked || !settings.timerEnabled ? "Off" : formatTime(seconds)}
              detail={timeDetail}
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

        <div className="mt-8 grid items-start gap-8 xl:grid-cols-[minmax(0,1.2fr)_360px]">
          <MotionSection
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.04 }}
            className="rounded-[2rem] border border-[var(--sw-border)] bg-[var(--sw-panel)] p-4 shadow-[var(--sw-shadow)] backdrop-blur-xl sm:p-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <h2 className="text-2xl text-[var(--sw-title)] [font-family:var(--font-display)]">Board</h2>
                <p className="mt-1 text-sm text-[var(--sw-muted)]">
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
                {isSignedIn && (
                  <UtilityButton
                    icon={<Archive className="h-4 w-4" />}
                    label={archiveSaving ? "Saving..." : archivedPuzzleId ? "Update archive" : `Archive ${archives.length}/${MAX_ARCHIVES}`}
                    onClick={archiveCurrentPuzzle}
                    disabled={archiveSaving || completed || (!archivedPuzzleId && archives.length >= MAX_ARCHIVES)}
                  />
                )}
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
              <div className="mt-5 rounded-[1.5rem] border border-[#f35e92]/25 bg-[#f35e92]/10 p-4 text-sm text-[var(--sw-text)]">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-start gap-2">
                    <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                    <p>Start a fresh {difficulty.toLowerCase()} board and clear the current progress?</p>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:w-[220px]">
                    <button
                      type="button"
                      onClick={() => setShowResetConfirm(false)}
                      className="rounded-xl border border-[var(--sw-border)] bg-[var(--sw-panel-soft)] px-3 py-2 font-medium text-[var(--sw-text)]"
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
                <div className="rounded-[1.5rem] border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] p-4 xl:sticky xl:top-6">
                  <div className="mb-3">
                    <div className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--sw-muted-strong)]">Remaining</div>
                    <div className="mt-1 text-sm text-[var(--sw-muted)]">{completionPercent(filledCount)}% filled</div>
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

              <div className="min-w-0 overflow-hidden rounded-[2rem] border border-[var(--sw-border)] bg-[var(--sw-board-card)] p-3 shadow-[var(--sw-shadow-tight)] sm:p-4">
                <div className="mx-auto aspect-square w-full max-w-[720px] overflow-hidden rounded-[1.25rem] border border-[var(--sw-board-frame)] bg-[var(--sw-board-frame)] shadow-[0_24px_50px_rgba(8,10,12,0.24)]">
                  <div className="grid h-full grid-cols-9 grid-rows-9 overflow-hidden bg-[var(--sw-board-frame)]">
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
                        let backgroundColor = fixed ? boardColors.fixed : boardColors.open;
                        let textColor = fixed ? boardColors.fixedText : boardColors.userText;
                        const shadowLayers = [];

                        if (sameRow || sameCol) {
                          backgroundColor = boardColors.rowCol;
                        }

                        if (sameBox) {
                          backgroundColor = boardColors.box;
                        }

                        if (sameNumber) {
                          backgroundColor = boardColors.match;
                          textColor = boardColors.matchText;
                          shadowLayers.push("inset 0 0 0 1px rgba(150,70,175,0.28)");
                        }

                        if (correctPulse) {
                          backgroundColor = boardColors.correct;
                          shadowLayers.push("inset 0 0 0 2px rgba(165,108,255,0.5)");
                        }

                        if (wrong) {
                          backgroundColor = boardColors.wrong;
                          textColor = boardColors.wrongText;
                          shadowLayers.push("inset 0 0 0 2px rgba(245,96,145,0.35)");
                        }

                        if (isSelected) {
                          shadowLayers.push("inset 0 0 0 2px rgba(242,124,225,0.88)");
                        }

                        const cellBorderStyle = {
                          borderStyle: "solid",
                          borderColor: boardColors.border,
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
                            animate={
                              wrongPulse
                                ? { opacity: [1, 0.82, 1, 0.88, 1], transition: { duration: 0.34 } }
                                : correctPulse
                                  ? { filter: ["brightness(1)", "brightness(1.22)", "brightness(1)"], transition: { duration: 0.3 } }
                                  : { opacity: 1, filter: "brightness(1)" }
                            }
                            onClick={() => setSelected({ r, c })}
                            style={cellBorderStyle}
                            className={classNames(
                              "relative flex aspect-square min-w-0 items-center justify-center overflow-hidden border-solid text-[1.05rem] font-bold leading-none outline-none transition-[background-color,color,box-shadow] duration-150 sm:text-[1.65rem]",
                              isSelected && "z-10"
                            )}
                          >
                            {correctPulse && (
                              <motion.span
                                initial={{ opacity: 0.75, scale: 0.8 }}
                                animate={{ opacity: 0, scale: 1 }}
                                transition={{ duration: 0.45 }}
                                className="pointer-events-none absolute inset-0 bg-[#bc6cff]/24 ring-2 ring-inset ring-[#d8a7ff]"
                              />
                            )}
                            {wrongPulse && (
                              <motion.span
                                initial={{ opacity: 0.78, scale: 1 }}
                                animate={{ opacity: 0, scale: 1 }}
                                transition={{ duration: 0.32 }}
                                className="pointer-events-none absolute inset-0 bg-[#f35e92]/28 ring-2 ring-inset ring-[#ff8eb7]"
                              />
                            )}

                            {value === 0 ? (
                              noteValues.length > 0 ? (
                                <span className="grid h-full w-full grid-cols-3 grid-rows-3 gap-0 p-1.5 text-[0.54rem] font-semibold leading-none sm:text-[0.7rem]" style={{ color: boardColors.noteText }}>
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
                {settings.liveValidation && <InlineStat label="Mistakes" value={String(mistakeCount)} />}
              </div>
              <p className="mt-4 text-sm leading-6 text-[var(--sw-muted)]">
                Scores, archives, and settings are tucked into your profile.
              </p>
            </PanelCard>

            <AnimatePresence>
              {completed && (
                <motion.div
                  initial={{ opacity: 0, y: 14, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 8, scale: 0.99 }}
                  className="rounded-[2rem] border border-[#bc6cff]/25 bg-[#bc6cff]/12 p-6 shadow-[var(--sw-shadow-tight)]"
                >
                  <div className="flex items-center gap-3">
                    <CheckCircle2 className="h-6 w-6 text-[#bc6cff]" />
                    <h2 className="text-2xl text-[var(--sw-title)] [font-family:var(--font-display)]">Solved</h2>
                  </div>
                  <p className="mt-3 text-sm leading-7 text-[var(--sw-muted)]">{winMessage}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </MotionAside>
        </div>
      </div>

      <ProfileDrawer
        open={profileOpen}
        tab={profileTab}
        setTab={setProfileTab}
        onClose={() => setProfileOpen(false)}
        isSignedIn={Boolean(isSignedIn)}
        email={isSignedIn ? profile.email : "Guest"}
        activeAvatar={activeAvatar}
        onAvatarChange={updateAvatar}
        bestTimes={bestTimes}
        gamesCompleted={gamesCompleted}
        archives={archives}
        profileLoaded={profileLoaded}
        onLoadArchive={loadArchivedPuzzle}
        onDeleteArchive={deleteArchivedPuzzle}
        settings={settings}
        onSettingsChange={commitSettings}
        onLogout={handleLogout}
        onShowAuth={() => {
          setProfileOpen(false);
          setAccountMode("gate");
        }}
        accountMessage={accountMessage}
      />
    </div>
  );
}

function completionPercent(filledCount) {
  return Math.round((filledCount / 81) * 100);
}

function AccountGate({ loading = false, message = "", onSignIn, onSignUp, onResetPassword, onGuest }) {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [localMessage, setLocalMessage] = useState("");

  const isSignup = mode === "signup";
  const isReset = mode === "reset";

  async function handleSubmit(event) {
    event.preventDefault();
    setLocalMessage("");

    if (loading) return;

    if (isSignup && password !== confirmPassword) {
      setLocalMessage("Passwords do not match.");
      return;
    }

    try {
      setBusy(true);
      if (isReset) {
        await onResetPassword(email);
        setLocalMessage("Password reset email sent.");
      } else if (isSignup) {
        await onSignUp(email, password);
      } else {
        await onSignIn(email, password);
      }
    } catch (error) {
      setLocalMessage(authErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,#3a1245_0%,#17081f_45%,#050507_100%)] px-4 py-8 text-[#f6efff]">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] max-w-6xl items-center justify-center">
        <div className="grid w-full items-center gap-8 lg:grid-cols-[minmax(0,0.95fr)_440px]">
          <div className="rounded-[2.4rem] border border-white/8 bg-[#0f0b16]/82 p-8 shadow-[0_24px_90px_rgba(0,0,0,0.36)] backdrop-blur-xl">
            <div className="inline-flex rounded-[1.8rem] border border-white/10 bg-black/25 p-3">
              <img src={wizardLogo} alt="Sudoku Wizard logo" className="h-24 w-auto" />
            </div>
            <h1 className="mt-6 text-5xl tracking-tight text-[#fbf5ff] [font-family:var(--font-display)]">
              Sudoku Wizard
            </h1>
            <p className="mt-4 max-w-xl text-lg leading-8 text-[#d9cce8]">
              Play as a guest, or sign in to save best times, completed boards, and archived puzzles.
            </p>
          </div>

          <form
            onSubmit={handleSubmit}
            className="rounded-[2.2rem] border border-white/8 bg-[#0f0b16]/90 p-6 shadow-[0_24px_90px_rgba(0,0,0,0.4)] backdrop-blur-xl"
          >
            <div className="flex items-center gap-3">
              {loading ? <LoaderCircle className="h-6 w-6 animate-spin text-[#f3a3eb]" /> : <ShieldCheck className="h-6 w-6 text-[#f3a3eb]" />}
              <h2 className="text-3xl text-[#fbf5ff] [font-family:var(--font-display)]">
                {loading ? "Loading" : isReset ? "Reset Password" : isSignup ? "Sign Up" : "Sign In"}
              </h2>
            </div>

            {!loading && (
              <div className="mt-6 grid grid-cols-2 gap-2 rounded-full border border-white/8 bg-black/20 p-1">
                <button
                  type="button"
                  onClick={() => setMode("signin")}
                  className={classNames("rounded-full px-4 py-2 text-sm font-semibold", mode === "signin" ? "bg-[#bc6cff] text-[#19091e]" : "text-[#d9cce8]")}
                >
                  Sign in
                </button>
                <button
                  type="button"
                  onClick={() => setMode("signup")}
                  className={classNames("rounded-full px-4 py-2 text-sm font-semibold", mode === "signup" ? "bg-[#bc6cff] text-[#19091e]" : "text-[#d9cce8]")}
                >
                  Sign up
                </button>
              </div>
            )}

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-[#e9dff5]">Email</span>
                <span className="mt-2 flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3">
                  <Mail className="h-4 w-4 text-[#c391ff]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    required
                    disabled={loading}
                    className="w-full bg-transparent text-[#f6efff] outline-none placeholder:text-[#8d7d9d]"
                    placeholder="you@example.com"
                  />
                </span>
              </label>

              {!isReset && !loading && (
                <label className="block">
                  <span className="text-sm font-semibold text-[#e9dff5]">Password</span>
                  <span className="mt-2 flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3">
                    <LockKeyhole className="h-4 w-4 text-[#c391ff]" />
                    <input
                      type="password"
                      value={password}
                      onChange={(event) => setPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-transparent text-[#f6efff] outline-none placeholder:text-[#8d7d9d]"
                      placeholder="Password"
                    />
                  </span>
                </label>
              )}

              {isSignup && (
                <label className="block">
                  <span className="text-sm font-semibold text-[#e9dff5]">Confirm password</span>
                  <span className="mt-2 flex items-center gap-3 rounded-[1.2rem] border border-white/10 bg-white/5 px-4 py-3">
                    <LockKeyhole className="h-4 w-4 text-[#c391ff]" />
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(event) => setConfirmPassword(event.target.value)}
                      required
                      minLength={6}
                      className="w-full bg-transparent text-[#f6efff] outline-none placeholder:text-[#8d7d9d]"
                      placeholder="Confirm password"
                    />
                  </span>
                </label>
              )}
            </div>

            {(localMessage || message) && (
              <div className="mt-4 rounded-[1rem] border border-[#f08be8]/20 bg-[#f08be8]/10 px-4 py-3 text-sm text-[#ffd7fb]">
                {localMessage || message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || busy}
              className="mt-6 flex w-full items-center justify-center rounded-full bg-[linear-gradient(135deg,#ff8fe1_0%,#9c62ff_100%)] px-5 py-3 font-semibold text-[#1d0922] disabled:opacity-50"
            >
              {busy ? "Working..." : loading ? "Loading..." : isReset ? "Send Reset Email" : isSignup ? "Create Account" : "Sign In"}
            </button>

            {!loading && (
              <div className="mt-4 flex flex-col items-center gap-3 text-sm">
                <button
                  type="button"
                  onClick={() => setMode(isReset ? "signin" : "reset")}
                  className="font-semibold text-[#f3a3eb] hover:text-[#ffd7fb]"
                >
                  {isReset ? "Back to sign in" : "Reset password"}
                </button>
                <button
                  type="button"
                  onClick={onGuest}
                  className="text-[#c8bdd6] underline decoration-white/20 underline-offset-4 hover:text-[#f6efff]"
                >
                  Continue as guest
                </button>
              </div>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function ProfileDrawer({
  open,
  tab,
  setTab,
  onClose,
  isSignedIn,
  email,
  activeAvatar,
  onAvatarChange,
  bestTimes,
  gamesCompleted,
  archives,
  profileLoaded,
  onLoadArchive,
  onDeleteArchive,
  settings,
  onSettingsChange,
  onLogout,
  onShowAuth,
  accountMessage,
}) {
  const ActiveAvatarIcon = activeAvatar.icon;
  const tabs = [
    { id: "scores", label: "Scores" },
    { id: "archives", label: "Archive" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm"
        >
          <button type="button" aria-label="Close profile" className="absolute inset-0 h-full w-full cursor-default" onClick={onClose} />
          <motion.aside
            initial={{ x: 420 }}
            animate={{ x: 0 }}
            exit={{ x: 420 }}
            transition={{ type: "spring", damping: 28, stiffness: 230 }}
            className="absolute right-0 top-0 flex h-full w-full max-w-[430px] flex-col border-l border-[var(--sw-border)] bg-[var(--sw-panel-strong)] p-5 shadow-[var(--sw-shadow)] backdrop-blur-2xl"
          >
            <div className="flex items-center justify-between gap-4">
              <div className="flex min-w-0 items-center gap-3">
                <span className={classNames("flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-gradient-to-br", activeAvatar.gradient)}>
                  <ActiveAvatarIcon className="h-7 w-7 text-white" />
                </span>
                <div className="min-w-0">
                  <div className="text-2xl text-[var(--sw-title)] [font-family:var(--font-display)]">
                    {isSignedIn ? "Profile" : "Guest"}
                  </div>
                  <div className="truncate text-sm text-[var(--sw-muted)]">{email}</div>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-full border border-[var(--sw-border)] bg-[var(--sw-panel-soft)] p-2 text-[var(--sw-text)] hover:bg-[var(--sw-panel-hover)]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-3 gap-2 rounded-full border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] p-1">
              {tabs.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={classNames("rounded-full px-3 py-2 text-sm font-semibold", tab === item.id ? "bg-[#bc6cff] text-[#19091e]" : "text-[var(--sw-muted)]")}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {accountMessage && (
              <div className="mt-4 rounded-[1rem] border border-[#f08be8]/25 bg-[#f08be8]/12 px-4 py-3 text-sm text-[var(--sw-text)]">
                {accountMessage}
              </div>
            )}

            <div className="mt-5 flex-1 overflow-y-auto pr-1">
              {tab === "scores" && (
                <div className="space-y-5">
                  <ProfilePanel icon={<User className="h-5 w-5 text-[#f3a3eb]" />} title="Avatar">
                    <div className="grid grid-cols-3 gap-3">
                      {AVATARS.map((avatar) => (
                        <AvatarChoice
                          key={avatar.id}
                          avatar={avatar}
                          selected={avatar.id === activeAvatar.id}
                          onClick={() => onAvatarChange(avatar.id)}
                        />
                      ))}
                    </div>
                  </ProfilePanel>

                  <ProfilePanel icon={<Trophy className="h-5 w-5 text-[#f3a3eb]" />} title="Scores">
                    {isSignedIn ? (
                      <div className="space-y-3">
                        <InlineStat label="Games completed" value={String(gamesCompleted)} />
                        {Object.keys(DIFFICULTIES).map((level) => (
                          <BestTimeRow key={level} level={level} value={bestTimes[level]} active={false} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm leading-6 text-[var(--sw-muted)]">Guest games do not save scores. Sign in if you want best times and completed boards to follow you.</p>
                    )}
                  </ProfilePanel>
                </div>
              )}

              {tab === "archives" && (
                <ProfilePanel icon={<Archive className="h-5 w-5 text-[#f3a3eb]" />} title={`Archive ${archives.length}/${MAX_ARCHIVES}`}>
                  {!isSignedIn ? (
                    <p className="text-sm leading-6 text-[var(--sw-muted)]">Archives are available after signing in.</p>
                  ) : !profileLoaded ? (
                    <p className="text-sm leading-6 text-[var(--sw-muted)]">Loading archives...</p>
                  ) : archives.length === 0 ? (
                    <p className="text-sm leading-6 text-[var(--sw-muted)]">No archived puzzles yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {archives.map((archive) => (
                        <div key={archive.id} className="rounded-[1.3rem] border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-semibold text-[var(--sw-title)]">{archive.name}</div>
                              <div className="mt-1 text-sm text-[var(--sw-muted)]">
                                {archive.difficulty} - {formatTime(archive.seconds ?? 0)} saved
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button
                                type="button"
                                onClick={() => onLoadArchive(archive)}
                                className="rounded-full border border-[#bc6cff]/25 bg-[#bc6cff]/12 p-2 text-[#f2dcff] hover:bg-[#bc6cff]/20"
                              >
                                <PlayCircle className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => onDeleteArchive(archive.id)}
                                className="rounded-full border border-[#f35e92]/25 bg-[#f35e92]/12 p-2 text-[#ffd7e4] hover:bg-[#f35e92]/20"
                              >
                                <Trash2 className="h-4 w-4" />
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </ProfilePanel>
              )}

              {tab === "settings" && (
                <ProfilePanel icon={settings.lightMode ? <Sun className="h-5 w-5 text-[#f3a3eb]" /> : <Moon className="h-5 w-5 text-[#c391ff]" />} title="Settings">
                  <div className="space-y-3">
                    {SETTINGS_LIST.map((item) => (
                      <ToggleRow
                        key={item.key}
                        label={item.label}
                        description={item.description}
                        enabled={settings[item.key]}
                        onToggle={() =>
                          onSettingsChange((current) => ({
                            ...current,
                            [item.key]: !current[item.key],
                          }))
                        }
                      />
                    ))}
                  </div>
                </ProfilePanel>
              )}
            </div>

            <div className="mt-5 border-t border-[var(--sw-border-soft)] pt-4">
              {isSignedIn ? (
                <UtilityButton icon={<LogOut className="h-4 w-4" />} label="Logout" onClick={onLogout} fullWidth />
              ) : (
                <UtilityButton icon={<CircleUserRound className="h-4 w-4" />} label="Sign in or sign up" onClick={onShowAuth} fullWidth />
              )}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ProfilePanel({ icon, title, children }) {
  return (
    <div className="rounded-[1.7rem] border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] p-5">
      <div className="mb-4 flex items-center gap-3">
        {icon}
        <h3 className="text-2xl text-[var(--sw-title)] [font-family:var(--font-display)]">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function AvatarChoice({ avatar, selected, onClick }) {
  const AvatarIcon = avatar.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={classNames(
        "rounded-[1.2rem] border p-3 text-center transition-all duration-200",
        selected ? "border-[#f08be8]/55 bg-[#f08be8]/14" : "border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] hover:bg-[var(--sw-panel-hover)]"
      )}
    >
      <span className={classNames("mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br", avatar.gradient)}>
        <AvatarIcon className="h-6 w-6 text-white" />
      </span>
      <span className="mt-2 block text-xs font-semibold text-[var(--sw-title)]">{avatar.label}</span>
    </button>
  );
}

function MetricCard({ icon, label, value, detail }) {
  return (
    <div className="rounded-[1.4rem] border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] p-4">
      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-[var(--sw-muted-strong)]">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-2xl text-[var(--sw-title)] [font-family:var(--font-display)]">{value}</div>
      <div className="mt-1 text-sm text-[var(--sw-muted)]">{detail}</div>
    </div>
  );
}

function PanelCard({ icon, title, children }) {
  return (
    <div className="rounded-[2rem] border border-[var(--sw-border)] bg-[var(--sw-panel)] p-6 shadow-[var(--sw-shadow)] backdrop-blur-xl">
      <div className="mb-4 flex items-center gap-3">
        {icon}
        <h2 className="text-2xl text-[var(--sw-title)] [font-family:var(--font-display)]">{title}</h2>
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
      className="flex w-full items-center justify-between gap-4 rounded-[1.4rem] border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] px-4 py-4 text-left transition-all duration-200 hover:bg-[var(--sw-panel-hover)]"
    >
      <div>
        <div className="font-semibold text-[var(--sw-title)]">{label}</div>
        <div className="mt-1 text-sm leading-6 text-[var(--sw-muted)]">{description}</div>
      </div>
      <span
        className={classNames(
          "relative block h-7 w-12 shrink-0 rounded-full transition-all duration-200",
          enabled ? "bg-[linear-gradient(135deg,#ff8fe1_0%,#9c62ff_100%)]" : "bg-[var(--sw-panel-hover)]"
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
          ? "border-[#f08be8]/35 bg-[#f08be8]/14 text-[var(--sw-title)] hover:bg-[#f08be8]/22"
          : "border-[var(--sw-border)] bg-[var(--sw-panel-soft)] text-[var(--sw-title)] hover:border-[#c98cff]/35 hover:bg-[var(--sw-panel-hover)]"
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
          : "border-[var(--sw-border)] bg-[var(--sw-panel-soft)] text-[var(--sw-muted)] hover:border-[#bc6cff]/35 hover:bg-[var(--sw-panel-hover)]"
      )}
    >
      {children}
    </button>
  );
}

function CounterPill({ digit, remaining, selected }) {
  const helperTextClass = remaining === 0 ? "text-[#9f58c7]" : selected ? "text-[#a12d93]" : "text-[var(--sw-muted)]";

  return (
    <div
      className={classNames(
        "flex min-w-0 flex-col items-center justify-center rounded-[1rem] border px-2 py-3 text-center transition-all duration-200",
        remaining === 0
          ? "border-[#bc6cff]/30 bg-[#bc6cff]/12 text-[var(--sw-complete-text)]"
          : "border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] text-[var(--sw-title)]",
        selected && remaining !== 0 && "border-[#f08be8]/45 bg-[#f08be8]/16 text-[#a12d93]"
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
    <div className="flex items-center justify-between rounded-[1rem] border border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)] px-3 py-2.5">
      <span className="text-sm text-[var(--sw-muted)]">{label}</span>
      <span className="text-sm font-semibold text-[var(--sw-title)]">{value}</span>
    </div>
  );
}

function BestTimeRow({ level, value, active }) {
  return (
    <div
      className={classNames(
        "flex items-center justify-between rounded-[1rem] border px-4 py-3",
        active ? "border-[#f08be8]/25 bg-[#f08be8]/10" : "border-[var(--sw-border-soft)] bg-[var(--sw-panel-soft)]"
      )}
    >
      <span className="font-semibold text-[var(--sw-title)]">{level}</span>
      <span className="text-sm text-[var(--sw-muted)]">{value ? formatTime(value) : "--:--"}</span>
    </div>
  );
}
