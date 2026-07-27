"use client";

import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

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
};

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
      if (!home || !away || match.homeScore === null || match.awayScore === null) return;
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

function SetupView({ onCreated }: { onCreated: (league: League, pin: string) => void }) {
  const [count, setCount] = useState(4);
  const [leagueName, setLeagueName] = useState("우리들의 FC 리그");
  const [pin, setPin] = useState("");
  const [names, setNames] = useState(["민서FC", "레알 종로", "뮌헨보이즈", "FC 성수"]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function changeCount(next: number) {
    setCount(next);
    setNames((current) =>
      Array.from({ length: next }, (_, index) => current[index] ?? `참가자 ${index + 1}`),
    );
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    const cleaned = names.map((name) => name.trim());
    if (cleaned.some((name) => !name)) {
      setError("모든 팀명을 입력해줘.");
      return;
    }
    if (new Set(cleaned).size !== cleaned.length) {
      setError("팀명은 서로 다르게 입력해줘.");
      return;
    }
    if (!/^\d{4}$/.test(pin)) {
      setError("관리 PIN은 숫자 4자리로 정해줘.");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch("/api/leagues", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: leagueName.trim(), teamNames: cleaned, pin }),
      });
      const body = (await response.json()) as { league?: League; error?: string };
      if (!response.ok || !body.league) throw new Error(body.error || "리그를 만들지 못했어.");
      onCreated(body.league, pin);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "잠시 후 다시 시도해줘.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="setup-page">
      <header className="topbar">
        <a className="brand" href="/" aria-label="킥오프 홈">
          <span className="brand-mark">K</span>
          <span>KICKOFF</span>
        </a>
        <span className="top-note">친구들과 만드는 우리만의 리그</span>
      </header>

      <section className="hero">
        <div className="eyebrow"><span /> FC ONLINE PRIVATE LEAGUE</div>
        <h1>게임은 한 판씩.<br /><em>경쟁은 리그답게.</em></h1>
        <p>팀을 모으고 일정을 만들면 끝. 결과를 입력할 때마다<br className="desktop-only" /> 순위와 최근 흐름이 실시간으로 바뀝니다.</p>
        <div className="hero-stats" aria-label="리그 규칙 요약">
          <div><strong>1</strong><span>ROUND<br />1 MATCH</span></div>
          <div><strong>3</strong><span>POINTS<br />FOR A WIN</span></div>
          <div><strong>∞</strong><span>FRIENDLY<br />RIVALRY</span></div>
        </div>
      </section>

      <section className="setup-card">
        <div className="card-heading">
          <span className="step-number">01</span>
          <div>
            <p>리그 만들기</p>
            <h2>누가 우승할지 정해볼까요?</h2>
          </div>
        </div>

        <form onSubmit={submit}>
          <div className="field-row">
            <label>
              <span>리그 이름</span>
              <input
                value={leagueName}
                maxLength={32}
                onChange={(event) => setLeagueName(event.target.value)}
                placeholder="예: 금요 FC 리그"
                required
              />
            </label>
            <label>
              <span>참가 인원</span>
              <select value={count} onChange={(event) => changeCount(Number(event.target.value))}>
                {Array.from({ length: 7 }, (_, index) => index + 3).map((value) => (
                  <option key={value} value={value}>{value}명</option>
                ))}
              </select>
            </label>
          </div>

          <div className="team-label-row">
            <span>팀명 또는 구단주명</span>
            <small>{count}팀 · 총 {count * (count - 1) / 2}경기</small>
          </div>
          <div className="team-grid">
            {names.map((name, index) => (
              <label className="team-input" key={index}>
                <TeamCrest name={name || "FC"} index={index} />
                <span className="team-number">{String(index + 1).padStart(2, "0")}</span>
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
              onChange={(event) => setPin(event.target.value.replace(/\D/g, "").slice(0, 4))}
              inputMode="numeric"
              type="password"
              autoComplete="new-password"
              placeholder="••••"
              aria-label="관리 PIN"
            />
          </div>

          {error && <p className="form-error" role="alert">{error}</p>}
          <button className="primary-button" type="submit" disabled={loading}>
            <span>{loading ? "일정 짜는 중..." : "랜덤 리그 일정 생성"}</span>
            <span aria-hidden="true">→</span>
          </button>
        </form>
        <p className="schedule-note"><span>✓</span> 연속 출전을 최소화하도록 경기 순서를 자동 조정합니다.</p>
      </section>
    </main>
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
  const teamMap = useMemo(() => new Map(league.teams.map((team) => [team.id, team])), [league]);
  const playedCount = league.matches.filter((match) => match.homeScore !== null).length;
  const nextMatch = league.matches.find((match) => match.homeScore === null);

  function setLocalScore(matchId: number, side: "homeScore" | "awayScore", value: string) {
    const parsed = value === "" ? null : Math.max(0, Math.min(99, Number(value)));
    onLeagueChange({
      ...league,
      matches: league.matches.map((match) =>
        match.id === matchId ? { ...match, [side]: parsed } : match,
      ),
    });
  }

  async function saveScore(match: Match) {
    if (!/^\d{4}$/.test(editPin)) {
      setMessage("관리 PIN 4자리를 입력해줘.");
      return;
    }
    if ((match.homeScore === null) !== (match.awayScore === null)) {
      setMessage("양 팀의 스코어를 모두 입력해줘.");
      return;
    }
    setSaving(match.id);
    setMessage("");
    try {
      const response = await fetch(`/api/leagues/${league.id}/matches/${match.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pin: editPin,
          homeScore: match.homeScore,
          awayScore: match.awayScore,
        }),
      });
      const body = (await response.json()) as { league?: League; error?: string };
      if (!response.ok || !body.league) throw new Error(body.error || "저장하지 못했어.");
      onLeagueChange(body.league);
      sessionStorage.setItem(`kickoff-pin-${league.id}`, editPin);
      setMessage("스코어가 저장됐어.");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "잠시 후 다시 시도해줘.");
    } finally {
      setSaving(null);
    }
  }

  async function share() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setMessage("공유 링크를 복사했어.");
    } catch {
      setMessage("주소창의 링크를 복사해 친구에게 보내줘.");
    }
  }

  return (
    <main className="league-page">
      <header className="league-header">
        <a className="brand brand-light" href="/">
          <span className="brand-mark">K</span><span>KICKOFF</span>
        </a>
        <div className="live-pill"><span /> LIVE LEAGUE</div>
        <button className="share-button" onClick={share}>공유하기 <span>↗</span></button>
      </header>

      <section className="league-hero">
        <div>
          <p className="season">2026 PRIVATE LEAGUE</p>
          <h1>{league.name}</h1>
          <p>{league.teams.length}개 팀 · 단일 라운드 로빈 · 승점제</p>
        </div>
        <div className="progress-card">
          <div><span>리그 진행률</span><strong>{Math.round((playedCount / league.matches.length) * 100)}%</strong></div>
          <div className="progress-track"><span style={{ width: `${(playedCount / league.matches.length) * 100}%` }} /></div>
          <small>{playedCount} / {league.matches.length} 경기 완료</small>
        </div>
      </section>

      <nav className="tabs" aria-label="리그 메뉴">
        <button className={tab === "table" ? "active" : ""} onClick={() => setTab("table")}>순위</button>
        <button className={tab === "fixtures" ? "active" : ""} onClick={() => setTab("fixtures")}>경기 일정 · 결과</button>
      </nav>

      <div className="dashboard-shell">
        {tab === "table" ? (
          <section className="standings-card">
            <div className="section-title">
              <div><p>LEAGUE TABLE</p><h2>현재 순위</h2></div>
              <span>마지막 갱신 {new Date(league.updatedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" })}</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr><th>순위</th><th>팀</th><th>경기</th><th>승</th><th>무</th><th>패</th><th>득실차</th><th>승점</th><th>최근 5경기</th></tr>
                </thead>
                <tbody>
                  {standings.map((team, index) => (
                    <tr key={team.id}>
                      <td><span className={`rank ${index < 3 ? `rank-${index + 1}` : ""}`}>{index + 1}</span></td>
                      <td><div className="table-team"><TeamCrest name={team.name} index={team.seed} small /><strong>{team.name}</strong></div></td>
                      <td>{team.played}</td><td>{team.won}</td><td>{team.drawn}</td><td>{team.lost}</td>
                      <td className={team.goalDifference > 0 ? "positive" : team.goalDifference < 0 ? "negative" : ""}>
                        {team.goalDifference > 0 ? "+" : ""}{team.goalDifference}
                      </td>
                      <td><strong className="points">{team.points}</strong></td>
                      <td><div className="form-dots">
                        {team.form.length ? team.form.map((result, resultIndex) => <span className={result} key={resultIndex}>{result}</span>) : <small>아직 경기 없음</small>}
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="legend"><span><i className="champion" /> 우승권</span><span><i /> 순위 결정: 승점 → 득실차 → 다득점</span></div>
          </section>
        ) : (
          <section className="fixtures-card">
            <div className="section-title fixtures-title">
              <div><p>MATCH CENTRE</p><h2>경기 일정 · 결과</h2></div>
              <label className="pin-inline"><span>관리 PIN</span><input value={editPin} onChange={(event) => setEditPin(event.target.value.replace(/\D/g, "").slice(0, 4))} inputMode="numeric" type="password" placeholder="••••" /></label>
            </div>
            <div className="fixtures-list">
              {league.matches.map((match) => {
                const home = teamMap.get(match.homeTeamId)!;
                const away = teamMap.get(match.awayTeamId)!;
                const isPlayed = match.homeScore !== null && match.awayScore !== null;
                return (
                  <article className={`fixture ${nextMatch?.id === match.id ? "fixture-next" : ""}`} key={match.id}>
                    <div className="round-label"><span>{String(match.round).padStart(2, "0")}</span><small>ROUND</small>{nextMatch?.id === match.id && <em>NEXT</em>}</div>
                    <div className="fixture-team home"><strong>{home.name}</strong><TeamCrest name={home.name} index={home.seed} /></div>
                    <div className="score-editor">
                      <input aria-label={`${home.name} 점수`} type="number" min="0" max="99" value={match.homeScore ?? ""} onChange={(event) => setLocalScore(match.id, "homeScore", event.target.value)} />
                      <span>:</span>
                      <input aria-label={`${away.name} 점수`} type="number" min="0" max="99" value={match.awayScore ?? ""} onChange={(event) => setLocalScore(match.id, "awayScore", event.target.value)} />
                    </div>
                    <div className="fixture-team away"><TeamCrest name={away.name} index={away.seed} /><strong>{away.name}</strong></div>
                    <button className={isPlayed ? "save-result saved" : "save-result"} onClick={() => saveScore(match)} disabled={saving === match.id}>
                      {saving === match.id ? "저장 중" : isPlayed ? "수정 저장" : "결과 저장"}
                    </button>
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
                  {[teamMap.get(nextMatch.homeTeamId)!, teamMap.get(nextMatch.awayTeamId)!].map((team) => (
                    <div key={team.id}><TeamCrest name={team.name} index={team.seed} /><strong>{team.name}</strong></div>
                  ))}
                </div>
                <b>VS</b>
              </>
            ) : <div className="season-complete">🏆<strong>모든 경기 완료!</strong></div>}
          </div>
          <div className="sync-card"><span className="sync-icon">↻</span><div><strong>자동 동기화 중</strong><small>다른 기기의 결과를 5초마다 반영해요.</small></div></div>
          {message && <div className="toast" role="status">{message}</div>}
        </aside>
      </div>
    </main>
  );
}

export default function Home() {
  const [league, setLeague] = useState<League | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");

  const leagueId = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("league") : null;
  const savedPin = typeof window !== "undefined" && leagueId ? sessionStorage.getItem(`kickoff-pin-${leagueId}`) ?? "" : "";

  const loadLeague = useCallback(async (quiet = false) => {
    if (!leagueId) {
      setLoading(false);
      return;
    }
    try {
      const response = await fetch(`/api/leagues/${leagueId}`, { cache: "no-store" });
      const body = (await response.json()) as { league?: League; error?: string };
      if (!response.ok || !body.league) throw new Error(body.error || "리그를 찾지 못했어.");
      setLeague(body.league);
      setLoadError("");
    } catch (cause) {
      if (!quiet) setLoadError(cause instanceof Error ? cause.message : "리그를 불러오지 못했어.");
    } finally {
      if (!quiet) setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    loadLeague();
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

  if (loading) return <main className="loading-page"><div className="ball-loader">K</div><p>리그 불러오는 중...</p></main>;
  if (loadError) return <main className="loading-page"><div className="ball-loader error">!</div><h1>{loadError}</h1><a href="/">새 리그 만들기</a></main>;
  if (league) return <LeagueView league={league} pin={savedPin} onLeagueChange={setLeague} />;
  return <SetupView onCreated={created} />;
}
