"use client";

import Link from "next/link";
import {
  FormEvent,
  PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

type Team = { id: number; name: string; seed: number };
type Match = {
  id: number;
  round: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore: number | null;
  awayScore: number | null;
};
type League = {
  id: string;
  name: string;
  teams: Team[];
  matches: Match[];
  updatedAt: string;
  meetingsPerPair?: 1 | 2;
};

type DraftMatch = { draftId: string; home: number; away: number };

type Standing = Team & {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  goalsFor: number;
  goalsAgainst: number;
  goalDifference: number;
  points: number;
  form: ("W" | "D" | "L")[];
};

const TEAM_COLORS = [
  ["#7158e2", "#a98eff"],
  ["#ff4f68", "#ff8b6a"],
  ["#00a878", "#53dfac"],
  ["#1677ff", "#5aa9ff"],
  ["#f09b22", "#ffd166"],
  ["#ee4f96", "#ff8dbe"],
  ["#1d3557", "#4d76a9"],
  ["#8d5b3d", "#d09a70"],
];

function crest(name: string, index: number) {
  const letters = name.replace(/\s/g, "").slice(0, 2).toUpperCase() || "FC";
  const colors = TEAM_COLORS[index % TEAM_COLORS.length];
  return { letters, colors };
}

function TeamCrest({
  name,
  index,
  small = false,
}: {
  name: string;
  index: number;
  small?: boolean;
}) {
  const badge = crest(name, index);
  return (
    <span
      className={`crest ${small ? "crest-small" : ""}`}
      style={{
        background: `linear-gradient(145deg, ${badge.colors[0]}, ${badge.colors[1]})`,
      }}
      aria-hidden="true"
    >
      {badge.letters}
    </span>
  );
}

function calculateStandings(league: League): Standing[] {
  const table = new Map<number, Standing>();
  league.teams.forEach((team) => {
    table.set(team.id, {
      ...team,
      played: 0,
      won: 0,
      drawn: 0,
      lost: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      goalDifference: 0,
      points: 0,
      form: [],
    });
  });

  league.matches
    .filter((match) => match.homeScore !== null && match.awayScore !== null)
    .sort((a, b) => a.round - b.round)
    .forEach((match) => {
      const home = table.get(match.homeTeamId);
      const away = table.get(match.awayTeamId);
      if (
        !home ||
        !away ||
        match.homeScore === null ||
        match.awayScore === null
      )
        return;
      home.played += 1;
      away.played += 1;
      home.goalsFor += match.homeScore;
      home.goalsAgainst += match.awayScore;
      away.goalsFor += match.awayScore;
      away.goalsAgainst += match.homeScore;
      if (match.homeScore > match.awayScore) {
        home.won += 1;
        away.lost += 1;
        home.points += 3;
        home.form.push("W");
        away.form.push("L");
      } else if (match.homeScore < match.awayScore) {
        away.won += 1;
        home.lost += 1;
        away.points += 3;
        away.form.push("W");
        home.form.push("L");
      } else {
        home.drawn += 1;
        away.drawn += 1;
        home.points += 1;
        away.points += 1;
        home.form.push("D");
        away.form.push("D");
      }
    });

  return [...table.values()]
    .map((team) => ({
      ...team,
      goalDifference: team.goalsFor - team.goalsAgainst,
      form: team.form.slice(-5),
    }))
    .sort(
      (a, b) =>
        b.points - a.points ||
        b.goalDifference - a.goalDifference ||
        b.goalsFor - a.goalsFor ||
        a.name.localeCompare(b.name, "ko"),
    );
}

function generateSchedule(
  teamCount: number,
  meetingsPerPair: 1 | 2,
): DraftMatch[] {
  const allPairs: DraftMatch[] = [];
  for (let first = 0; first < teamCount; first += 1) {
    for (let second = first + 1; second < teamCount; second += 1) {
      const flipped = Math.random() > 0.5;
      const home = flipped ? second : first;
      const away = flipped ? first : second;
      allPairs.push({ draftId: `${first}-${second}-1`, home, away });
      if (meetingsPerPair === 2) {
        allPairs.push({
          draftId: `${first}-${second}-2`,
          home: away,
          away: home,
        });
      }
    }
  }

  let best: DraftMatch[] = [];
  let bestPenalty = Number.POSITIVE_INFINITY;
  for (let attempt = 0; attempt < 350; attempt += 1) {
    const remaining = [...allPairs].sort(() => Math.random() - 0.5);
    const schedule: DraftMatch[] = [];
    let penalty = 0;
    while (remaining.length) {
      const previous = schedule.at(-1);
      const twoBack = schedule.at(-2);
      let candidateIndex = 0;
      let candidatePenalty = Number.POSITIVE_INFINITY;
      remaining.forEach((pair, index) => {
        const overlapsPrevious = previous
          ? [pair.home, pair.away].filter(
              (id) => id === previous.home || id === previous.away,
            ).length
          : 0;
        const overlapsTwoBack = twoBack
          ? [pair.home, pair.away].filter(
              (id) => id === twoBack.home || id === twoBack.away,
            ).length
          : 0;
        const reverseRematch =
          previous && pair.home === previous.away && pair.away === previous.home
            ? 1
            : 0;
        const score =
          overlapsPrevious * 100 +
          overlapsTwoBack * 8 +
          reverseRematch * 60 +
          Math.random() * 4;
        if (score < candidatePenalty) {
          candidatePenalty = score;
          candidateIndex = index;
        }
      });
      penalty += candidatePenalty;
      schedule.push(remaining.splice(candidateIndex, 1)[0]);
    }
    if (penalty < bestPenalty) {
      best = schedule;
      bestPenalty = penalty;
    }
  }
  return best;
}

function hasConsecutivePlayer(schedule: DraftMatch[], index: number) {
  if (index === 0) return false;
  const current = schedule[index];
  const previous = schedule[index - 1];
  return [current.home, current.away].some(
    (player) => player === previous.home || player === previous.away,
  );
}

function SetupView({
  onCreated,
}: {
  onCreated: (league: League, pin: string) => void;
}) {
  const [count, setCount] = useState(4);
  const [leagueName, setLeagueName] = useState("우리들의 FC 리그");
  const [pin, setPin] = useState("");
  const [names, setNames] = useState([
    "참가자 1",
    "참가자 2",
    "참가자 3",
    "참가자 4",
  ]);
  const [meetingsPerPair, setMeetingsPerPair] = useState<1 | 2>(1);
  const [draftSchedule, setDraftSchedule] = useState<DraftMatch[] | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const pointerDragIndex = useRef<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const totalMatches = ((count * (count - 1)) / 2) * meetingsPerPair;

  function changeCount(next: number) {
    setCount(next);
    setNames((current) =>
      Array.from(
        { length: next },
        (_, index) => current[index] ?? `참가자 ${index + 1}`,
      ),
    );
  }

  function validateSetup() {
    setError("");
    const cleaned = names.map((name) => name.trim());
    if (cleaned.some((name) => !name)) {
      setError("모든 팀명을 입력해 주세요.");
      return null;
    }
    if (new Set(cleaned).size !== cleaned.length) {
      setError("팀명은 서로 다르게 입력해 주세요.");
      return null;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("관리 PIN은 숫자 4자리로 정해 주세요.");
      return null;
    }
    if (!leagueName.trim()) {
      setError("리그 이름을 입력해 주세요.");
      return null;
    }
    return cleaned;
  }

  function previewSchedule(event: FormEvent) {
    event.preventDefault();
    const cleaned = validateSetup();
    if (!cleaned) return;
    setNames(cleaned);
    setDraftSchedule(generateSchedule(count, meetingsPerPair));
    setError("");
  }

  function moveMatch(from: number, to: number) {
    if (!draftSchedule || from === to || to < 0 || to >= draftSchedule.length)
      return;
    setDraftSchedule((current) => {
      if (!current) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }

  function endPointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    pointerDragIndex.current = null;
    setDraggedIndex(null);
    setDragOverIndex(null);
  }

  function continuePointerDrag(event: ReactPointerEvent<HTMLButtonElement>) {
    const from = pointerDragIndex.current;
    if (from === null) return;
    const target = document
      .elementFromPoint(event.clientX, event.clientY)
      ?.closest<HTMLElement>("[data-draft-index]");
    const to = Number(target?.dataset.draftIndex);
    if (!Number.isInteger(to) || from === to) return;
    moveMatch(from, to);
    pointerDragIndex.current = to;
    setDraggedIndex(to);
    setDragOverIndex(to);
  }

  async function confirmSchedule() {
    if (!draftSchedule) return;
    const cleaned = validateSetup();
    if (!cleaned) return;
    setLoading(true);
    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: leagueName.trim(),
          teamNames: cleaned,
          pin,
          meetingsPerPair,
          schedule: draftSchedule.map(({ home, away }) => ({ home, away })),
        }),
      });
      const body = (await response.json()) as {
        league?: League;
        error?: string;
      };
      if (!response.ok || !body.league)
        throw new Error(body.error || "리그를 만들지 못했습니다.");
      onCreated(body.league, pin);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.",
      );
    } finally {
      setLoading(false);
    }
  }

  const setupForm = (
    <form onSubmit={previewSchedule}>
      <div className="field-row">
        <label>
          <span>리그 이름</span>
          <input
            value={leagueName}
            maxLength={32}
            onChange={(event) => setLeagueName(event.target.value)}
            placeholder="예: 우리들의 FC 리그"
            required
          />
        </label>
        <label>
          <span>참가 인원</span>
          <select
            value={count}
            onChange={(event) => changeCount(Number(event.target.value))}
          >
            {Array.from({ length: 7 }, (_, index) => index + 3).map((value) => (
              <option key={value} value={value}>
                {value}명
              </option>
            ))}
          </select>
        </label>
      </div>

      <fieldset className="mode-picker">
        <legend>대결 방식</legend>
        <button
          type="button"
          className={meetingsPerPair === 1 ? "active" : ""}
          onClick={() => setMeetingsPerPair(1)}
        >
          <strong>한 번씩 대결</strong>
          <small>팀당 {count - 1}경기</small>
        </button>
        <button
          type="button"
          className={meetingsPerPair === 2 ? "active" : ""}
          onClick={() => setMeetingsPerPair(2)}
        >
          <strong>두 번씩 대결</strong>
          <small>홈·원정 · 팀당 {(count - 1) * 2}경기</small>
        </button>
      </fieldset>

      <div className="team-label-row">
        <span>팀명 또는 구단주명</span>
        <small>
          {count}팀 · 총 {totalMatches}경기
        </small>
      </div>
      <div className="team-grid">
        {names.map((name, index) => (
          <label className="team-input" key={index}>
            <TeamCrest name={name || "FC"} index={index} />
            <span className="team-number">
              {String(index + 1).padStart(2, "0")}
            </span>
            <input
              aria-label={`${index + 1}번 팀명`}
              value={name}
              maxLength={18}
              onChange={(event) =>
                setNames((current) =>
                  current.map((item, itemIndex) =>
                    itemIndex === index ? event.target.value : item,
                  ),
                )
              }
            />
          </label>
        ))}
      </div>

      <div className="pin-row">
        <div>
          <span>관리 PIN</span>
          <small>점수 수정에 사용할 숫자 4자리</small>
        </div>
        <input
          value={pin}
          onChange={(event) =>
            setPin(event.target.value.replace(/\D/g, "").slice(0, 4))
          }
          inputMode="numeric"
          type="password"
          autoComplete="new-password"
          placeholder="••••"
          aria-label="관리 PIN"
        />
      </div>

      {error && (
        <p className="form-error" role="alert">
          {error}
        </p>
      )}
      <button className="primary-button" type="submit">
        <span>랜덤 일정 미리보기</span>
        <span aria-hidden="true">→</span>
      </button>
    </form>
  );

  return (
    <main className="setup-page">
      <header className="topbar">
        <Link className="brand" href="/" aria-label="킥오프 홈">
          <span className="brand-mark">K</span>
          <span>KICKOFF</span>
        </Link>
        <span className="top-note">친구들과 만드는 우리만의 리그</span>
      </header>

      <section className="hero">
        <div className="eyebrow">
          <span /> FC ONLINE PRIVATE LEAGUE
        </div>
        <h1>
          게임은 한 판씩.
          <br />
          <em>경쟁은 리그답게.</em>
        </h1>
        <p>
          팀을 모으고 일정을 만들면 끝. 결과를 입력할 때마다
          <br className="desktop-only" /> 순위와 최근 흐름이 실시간으로
          바뀝니다.
        </p>
        <div className="hero-stats" aria-label="리그 규칙 요약">
          <div>
            <strong>1</strong>
            <span>
              ROUND
              <br />1 MATCH
            </span>
          </div>
          <div>
            <strong>3</strong>
            <span>
              POINTS
              <br />
              FOR A WIN
            </span>
          </div>
          <div>
            <strong>∞</strong>
            <span>
              FRIENDLY
              <br />
              RIVALRY
            </span>
          </div>
        </div>
      </section>

      <section
        className={`setup-card ${draftSchedule ? "schedule-builder-card" : ""}`}
      >
        <div className="card-heading">
          <span className="step-number">{draftSchedule ? "02" : "01"}</span>
          <div>
            <p>{draftSchedule ? "일정 조정" : "리그 만들기"}</p>
            <h2>
              {draftSchedule
                ? "경기 순서를 확인하고 확정해 주세요"
                : "우리만의 우승 경쟁을 시작해 보세요"}
            </h2>
          </div>
        </div>

        {!draftSchedule ? (
          setupForm
        ) : (
          <div className="schedule-builder">
            <div className="schedule-summary">
              <div>
                <span>{leagueName}</span>
                <strong>
                  {count}팀 · {totalMatches}경기
                </strong>
              </div>
              <button
                type="button"
                onClick={() =>
                  setDraftSchedule(generateSchedule(count, meetingsPerPair))
                }
              >
                ↻ 다시 섞기
              </button>
            </div>
            <p className="drag-guide">
              <span>☷</span> 경기 카드를 드래그해 원하는 순서로 옮겨 보세요.
            </p>
            <div className="draft-list">
              {draftSchedule.map((match, index) => (
                <article
                  className={`draft-match ${draggedIndex === index ? "dragging" : ""} ${dragOverIndex === index ? "drag-over" : ""}`}
                  key={match.draftId}
                  data-draft-index={index}
                >
                  <button
                    className="drag-handle"
                    type="button"
                    aria-label={`${index + 1}라운드 경기 순서 이동`}
                    aria-pressed={draggedIndex === index}
                    onPointerDown={(event) => {
                      event.currentTarget.setPointerCapture(event.pointerId);
                      pointerDragIndex.current = index;
                      setDraggedIndex(index);
                      setDragOverIndex(index);
                    }}
                    onPointerMove={continuePointerDrag}
                    onPointerUp={endPointerDrag}
                    onPointerCancel={endPointerDrag}
                  >
                    ⠿
                  </button>
                  <div className="draft-round">
                    <strong>{String(index + 1).padStart(2, "0")}</strong>
                    <span>ROUND</span>
                  </div>
                  <div className="draft-team home">
                    <span>{names[match.home]}</span>
                    <TeamCrest
                      name={names[match.home]}
                      index={match.home}
                      small
                    />
                  </div>
                  <b>VS</b>
                  <div className="draft-team">
                    <TeamCrest
                      name={names[match.away]}
                      index={match.away}
                      small
                    />
                    <span>{names[match.away]}</span>
                  </div>
                  {hasConsecutivePlayer(draftSchedule, index) ? (
                    <em className="streak-warning">연속 출전</em>
                  ) : (
                    <em className="rest-ok">휴식 배정</em>
                  )}
                  <div className="move-buttons">
                    <button
                      type="button"
                      onClick={() => moveMatch(index, index - 1)}
                      disabled={index === 0}
                      aria-label="한 칸 위로"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      onClick={() => moveMatch(index, index + 1)}
                      disabled={index === draftSchedule.length - 1}
                      aria-label="한 칸 아래로"
                    >
                      ↓
                    </button>
                  </div>
                </article>
              ))}
            </div>
            {error && (
              <p className="form-error" role="alert">
                {error}
              </p>
            )}
            <div className="confirm-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDraftSchedule(null)}
              >
                ← 참가자 수정
              </button>
              <button
                type="button"
                className="primary-button"
                onClick={confirmSchedule}
                disabled={loading}
              >
                <span>
                  {loading ? "리그 생성 중..." : "이 일정으로 리그 확정"}
                </span>
                <span>✓</span>
              </button>
            </div>
          </div>
        )}
        <p className="schedule-note">
          <span>✓</span> 연속 출전을 최소화하도록 경기 순서를 자동 조정합니다.
        </p>
      </section>
    </main>
  );
}

function ScoreEditor({
  match,
  homeName,
  awayName,
  saving,
  onSave,
}: {
  match: Match;
  homeName: string;
  awayName: string;
  saving: boolean;
  onSave: (
    match: Match,
    homeScore: number | null,
    awayScore: number | null,
  ) => Promise<boolean>;
}) {
  const serverHome = match.homeScore === null ? "" : String(match.homeScore);
  const serverAway = match.awayScore === null ? "" : String(match.awayScore);
  const [homeDraft, setHomeDraft] = useState(serverHome);
  const [awayDraft, setAwayDraft] = useState(serverAway);
  const [userEditing, setUserEditing] = useState(false);
  const dirty = homeDraft !== serverHome || awayDraft !== serverAway;
  const complete =
    (homeDraft === "" && awayDraft === "") ||
    (homeDraft !== "" && awayDraft !== "");

  useEffect(() => {
    if (userEditing) return;
    const syncTimer = window.setTimeout(() => {
      setHomeDraft(serverHome);
      setAwayDraft(serverAway);
    }, 0);
    return () => window.clearTimeout(syncTimer);
  }, [serverHome, serverAway, userEditing]);

  function cleanScore(value: string) {
    const digits = value.replace(/\D/g, "").slice(0, 2);
    if (digits === "") return "";
    return String(Math.min(99, Number(digits)));
  }

  async function submitScore() {
    if (!dirty || !complete || saving) return;
    const saved = await onSave(
      match,
      homeDraft === "" ? null : Number(homeDraft),
      awayDraft === "" ? null : Number(awayDraft),
    );
    if (saved) setUserEditing(false);
  }

  return (
    <>
      <div className={`score-editor ${dirty ? "score-dirty" : ""}`}>
        <input
          aria-label={`${homeName} 점수`}
          inputMode="numeric"
          type="text"
          maxLength={2}
          enterKeyHint="next"
          value={homeDraft}
          onChange={(event) => {
            setUserEditing(true);
            setHomeDraft(cleanScore(event.target.value));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submitScore();
          }}
          placeholder="–"
        />
        <span>:</span>
        <input
          aria-label={`${awayName} 점수`}
          inputMode="numeric"
          type="text"
          maxLength={2}
          enterKeyHint="done"
          value={awayDraft}
          onChange={(event) => {
            setUserEditing(true);
            setAwayDraft(cleanScore(event.target.value));
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") void submitScore();
          }}
          placeholder="–"
        />
        {(homeDraft !== "" || awayDraft !== "") && (
          <button
            className="score-clear"
            type="button"
            aria-label="스코어 지우기"
            title="스코어 지우기"
            onClick={() => {
              setUserEditing(true);
              setHomeDraft("");
              setAwayDraft("");
            }}
          >
            ×
          </button>
        )}
      </div>
      <button
        className={
          match.homeScore !== null ? "save-result saved" : "save-result"
        }
        onClick={() => void submitScore()}
        type="button"
        disabled={saving || !dirty || !complete}
        title={!complete ? "양 팀 점수를 모두 입력해 주세요" : undefined}
      >
        {saving
          ? "저장 중"
          : !complete
            ? "양쪽 입력"
            : match.homeScore !== null
              ? "수정 저장"
              : "결과 저장"}
      </button>
    </>
  );
}

function LeagueView({
  league,
  pin,
  onLeagueChange,
}: {
  league: League;
  pin: string;
  onLeagueChange: (league: League) => void;
}) {
  const [tab, setTab] = useState<"table" | "fixtures">("table");
  const [editPin, setEditPin] = useState(pin);
  const [saving, setSaving] = useState<number | null>(null);
  const [message, setMessage] = useState("");
  const standings = useMemo(() => calculateStandings(league), [league]);
  const teamMap = useMemo(
    () => new Map(league.teams.map((team) => [team.id, team])),
    [league],
  );
  const playedCount = league.matches.filter(
    (match) => match.homeScore !== null,
  ).length;
  const nextMatch = league.matches.find((match) => match.homeScore === null);
  const meetingsPerPair =
    league.meetingsPerPair ??
    (league.matches.length === league.teams.length * (league.teams.length - 1)
      ? 2
      : 1);

  async function saveScore(
    match: Match,
    homeScore: number | null,
    awayScore: number | null,
  ) {
    if (!/^\d{4}$/.test(editPin)) {
      setMessage("관리 PIN 4자리를 입력해 주세요.");
      return false;
    }
    setSaving(match.id);
    setMessage("");
    try {
      const response = await fetch(
        `/api/leagues/${league.id}/matches/${match.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            pin: editPin,
            homeScore,
            awayScore,
          }),
        },
      );
      const body = (await response.json()) as {
        league?: League;
        error?: string;
      };
      if (!response.ok || !body.league)
        throw new Error(body.error || "저장하지 못했습니다.");
      onLeagueChange(body.league);
      sessionStorage.setItem(`kickoff-pin-${league.id}`, editPin);
      setMessage("스코어가 저장됐습니다.");
      return true;
    } catch (cause) {
      setMessage(
        cause instanceof Error ? cause.message : "잠시 후 다시 시도해 주세요.",
      );
      return false;
    } finally {
      setSaving(null);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("공유 링크를 복사했습니다.");
    } catch {
      setMessage("주소창의 링크를 복사해 친구에게 보내 주세요.");
    }
  }

  return (
    <main className="league-page">
      <header className="league-header">
        <Link className="brand brand-light" href="/">
          <span className="brand-mark">K</span>
          <span>KICKOFF</span>
        </Link>
        <div className="live-pill">
          <span /> LIVE LEAGUE
        </div>
        <button className="share-button" onClick={share}>
          공유하기 <span>↗</span>
        </button>
      </header>

      <section className="league-hero">
        <div>
          <p className="season">2026 PRIVATE LEAGUE</p>
          <h1>{league.name}</h1>
          <p>
            {league.teams.length}개 팀 ·{" "}
            {meetingsPerPair === 2 ? "팀별 2회 대결" : "팀별 1회 대결"} · 승점제
          </p>
        </div>
        <div className="progress-card">
          <div>
            <span>리그 진행률</span>
            <strong>
              {Math.round((playedCount / league.matches.length) * 100)}%
            </strong>
          </div>
          <div className="progress-track">
            <span
              style={{
                width: `${(playedCount / league.matches.length) * 100}%`,
              }}
            />
          </div>
          <small>
            {playedCount} / {league.matches.length} 경기 완료
          </small>
        </div>
      </section>

      <nav className="tabs" aria-label="리그 메뉴">
        <button
          className={tab === "table" ? "active" : ""}
          onClick={() => setTab("table")}
        >
          순위
        </button>
        <button
          className={tab === "fixtures" ? "active" : ""}
          onClick={() => setTab("fixtures")}
        >
          경기 일정 · 결과
        </button>
      </nav>

      <div className="dashboard-shell">
        {tab === "table" ? (
          <section className="standings-card">
            <div className="section-title">
              <div>
                <p>LEAGUE TABLE</p>
                <h2>현재 순위</h2>
              </div>
              <span>
                마지막 갱신{" "}
                {new Date(
                  league.updatedAt.includes("T")
                    ? league.updatedAt
                    : `${league.updatedAt.replace(" ", "T")}Z`,
                ).toLocaleTimeString("ko-KR", {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            <div className="table-scroll desktop-standings">
              <table>
                <thead>
                  <tr>
                    <th>순위</th>
                    <th>팀</th>
                    <th>경기</th>
                    <th>승</th>
                    <th>무</th>
                    <th>패</th>
                    <th>득실차</th>
                    <th>승점</th>
                    <th>최근 5경기</th>
                  </tr>
                </thead>
                <tbody>
                  {standings.map((team, index) => (
                    <tr key={team.id}>
                      <td>
                        <span
                          className={`rank ${index < 3 ? `rank-${index + 1}` : ""}`}
                        >
                          {index + 1}
                        </span>
                      </td>
                      <td>
                        <div className="table-team">
                          <TeamCrest name={team.name} index={team.seed} small />
                          <strong>{team.name}</strong>
                        </div>
                      </td>
                      <td>{team.played}</td>
                      <td>{team.won}</td>
                      <td>{team.drawn}</td>
                      <td>{team.lost}</td>
                      <td
                        className={
                          team.goalDifference > 0
                            ? "positive"
                            : team.goalDifference < 0
                              ? "negative"
                              : ""
                        }
                      >
                        {team.goalDifference > 0 ? "+" : ""}
                        {team.goalDifference}
                      </td>
                      <td>
                        <strong className="points">{team.points}</strong>
                      </td>
                      <td>
                        <div className="form-dots">
                          {team.form.length ? (
                            team.form.map((result, resultIndex) => (
                              <span className={result} key={resultIndex}>
                                {result}
                              </span>
                            ))
                          ) : (
                            <small>아직 경기 없음</small>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <ol className="mobile-standings" aria-label="현재 리그 순위">
              {standings.map((team, index) => (
                <li className="mobile-standing" key={team.id}>
                  <div className="mobile-standing-main">
                    <span
                      className={`rank ${index < 3 ? `rank-${index + 1}` : ""}`}
                      aria-label={`${index + 1}위`}
                    >
                      {index + 1}
                    </span>
                    <TeamCrest name={team.name} index={team.seed} small />
                    <strong className="mobile-team-name">{team.name}</strong>
                    <div className="mobile-points">
                      <strong>{team.points}</strong>
                      <span>승점</span>
                    </div>
                  </div>
                  <div className="mobile-standing-detail">
                    <span>
                      <b>{team.played}</b> 경기
                    </span>
                    <span>
                      <b>{team.won}</b>승
                    </span>
                    <span>
                      <b>{team.drawn}</b>무
                    </span>
                    <span>
                      <b>{team.lost}</b>패
                    </span>
                    <span
                      className={
                        team.goalDifference > 0
                          ? "positive"
                          : team.goalDifference < 0
                            ? "negative"
                            : ""
                      }
                    >
                      득실{" "}
                      <b>
                        {team.goalDifference > 0 ? "+" : ""}
                        {team.goalDifference}
                      </b>
                    </span>
                  </div>
                  <div className="mobile-form">
                    <span>최근 경기</span>
                    <div
                      className="form-dots"
                      aria-label={
                        team.form.length
                          ? `최근 경기 ${team.form.join(", ")}`
                          : "아직 진행된 경기가 없습니다"
                      }
                    >
                      {team.form.length ? (
                        team.form.map((result, resultIndex) => (
                          <span className={result} key={resultIndex}>
                            {result}
                          </span>
                        ))
                      ) : (
                        <small>아직 진행된 경기가 없습니다</small>
                      )}
                    </div>
                  </div>
                </li>
              ))}
            </ol>
            <div className="legend">
              <span>
                <i className="champion" /> 우승권
              </span>
              <span>
                <i /> 순위 결정: 승점 → 득실차 → 다득점
              </span>
            </div>
          </section>
        ) : (
          <section className="fixtures-card">
            <div className="section-title fixtures-title">
              <div>
                <p>MATCH CENTRE</p>
                <h2>경기 일정 · 결과</h2>
              </div>
              <label className="pin-inline">
                <span>관리 PIN</span>
                <input
                  value={editPin}
                  onChange={(event) =>
                    setEditPin(
                      event.target.value.replace(/\D/g, "").slice(0, 4),
                    )
                  }
                  inputMode="numeric"
                  type="password"
                  placeholder="••••"
                />
              </label>
            </div>
            <div className="fixtures-list">
              {league.matches.map((match) => {
                const home = teamMap.get(match.homeTeamId)!;
                const away = teamMap.get(match.awayTeamId)!;
                return (
                  <article
                    className={`fixture ${nextMatch?.id === match.id ? "fixture-next" : ""}`}
                    key={match.id}
                  >
                    <div className="round-label">
                      <span>{String(match.round).padStart(2, "0")}</span>
                      <small>ROUND</small>
                      {nextMatch?.id === match.id && <em>NEXT</em>}
                    </div>
                    <div className="fixture-team home">
                      <strong>{home.name}</strong>
                      <TeamCrest name={home.name} index={home.seed} />
                    </div>
                    <div className="fixture-team away">
                      <TeamCrest name={away.name} index={away.seed} />
                      <strong>{away.name}</strong>
                    </div>
                    <ScoreEditor
                      match={match}
                      homeName={home.name}
                      awayName={away.name}
                      saving={saving === match.id}
                      onSave={saveScore}
                    />
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <aside className="side-panel">
          <div className="next-card">
            <p>NEXT MATCH</p>
            {nextMatch ? (
              <>
                <span>ROUND {String(nextMatch.round).padStart(2, "0")}</span>
                <div className="next-teams">
                  {[
                    teamMap.get(nextMatch.homeTeamId)!,
                    teamMap.get(nextMatch.awayTeamId)!,
                  ].map((team) => (
                    <div key={team.id}>
                      <TeamCrest name={team.name} index={team.seed} />
                      <strong>{team.name}</strong>
                    </div>
                  ))}
                </div>
                <b>VS</b>
              </>
            ) : (
              <div className="season-complete">
                🏆<strong>모든 경기 완료!</strong>
              </div>
            )}
          </div>
          <div className="sync-card">
            <span className="sync-icon">↻</span>
            <div>
              <strong>자동 동기화 중</strong>
              <small>다른 기기의 결과를 5초마다 반영합니다.</small>
            </div>
          </div>
          {message && (
            <div className="toast" role="status" aria-live="polite">
              {message}
            </div>
          )}
        </aside>
      </div>
    </main>
  );
}

export default function Home() {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const leagueId =
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("league")
      : null;
  const savedPin =
    typeof window !== "undefined" && leagueId
      ? (sessionStorage.getItem(`kickoff-pin-${leagueId}`) ?? "")
      : "";

  const loadLeague = useCallback(
    async (quiet = false) => {
      if (!leagueId) {
        setLoading(false);
        return;
      }
      try {
        const response = await fetch(`/api/leagues/${leagueId}`, {
          cache: "no-store",
        });
        const body = (await response.json()) as {
          league?: League;
          error?: string;
        };
        if (!response.ok || !body.league)
          throw new Error(body.error || "리그를 찾지 못했습니다.");
        setLeague(body.league);
        setLoadError("");
      } catch (cause) {
        if (!quiet)
          setLoadError(
            cause instanceof Error
              ? cause.message
              : "리그를 불러오지 못했습니다.",
          );
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [leagueId],
  );

  useEffect(() => {
    const initialLoadTimer = window.setTimeout(() => void loadLeague(), 0);
    return () => window.clearTimeout(initialLoadTimer);
  }, [loadLeague]);

  useEffect(() => {
    if (!leagueId) return;
    const timer = window.setInterval(() => loadLeague(true), 5000);
    return () => window.clearInterval(timer);
  }, [leagueId, loadLeague]);

  function created(next: League, pin: string) {
    sessionStorage.setItem(`kickoff-pin-${next.id}`, pin);
    window.history.pushState({}, "", `?league=${next.id}`);
    window.location.reload();
  }

  if (loading)
    return (
      <main className="loading-page">
        <div className="ball-loader">K</div>
        <p>리그 불러오는 중...</p>
      </main>
    );
  if (loadError)
    return (
      <main className="loading-page">
        <div className="ball-loader error">!</div>
        <h1>{loadError}</h1>
        <Link href="/">새 리그 만들기</Link>
      </main>
    );
  if (league)
    return (
      <LeagueView league={league} pin={savedPin} onLeagueChange={setLeague} />
    );
  return <SetupView onCreated={created} />;
}
