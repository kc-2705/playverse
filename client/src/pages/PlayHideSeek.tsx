import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, App, Avatar, Button, Input, Progress, Space, Tag, Tooltip } from 'antd';
import { ArrowLeftOutlined, CloseOutlined, CopyOutlined, CrownFilled, EyeInvisibleOutlined, LoginOutlined, PlusOutlined, CaretRightOutlined } from '@ant-design/icons';
import { HideSeekGame } from '../games/hideseek/HideSeekGame';
import { HideSeekNet, type GameEvent, type RoomState } from '../games/hideseek/net';
import { KIND_LABELS, KINDS, type Kind } from '../games/hideseek/map';
import { AVATARS } from '../games/catalog';
import { useAuth } from '../auth/AuthContext';
import CharacterPicker from '../components/CharacterPicker';
import { preferredCharacter, type CharacterId } from '../games/shared/hero';


const touchDevice = typeof window !== 'undefined' && window.matchMedia('(pointer: coarse)').matches;
const KIND_ICONS: Record<Kind, string> = { vase: '🏺', bust: '🗿', bench: '🪑', plant: '🌿' };
const clock = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
};

export default function PlayHideSeek() {
  const navigate = useNavigate();
  const closeButton = (
    <Button className="panel-close" type="text" shape="circle" icon={<CloseOutlined />} aria-label="Back to games" onClick={() => navigate('/')} />
  );
  const { message } = App.useApp();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();
  const stageRef = useRef<HTMLDivElement>(null);
  const netRef = useRef<HideSeekNet | null>(null);
  const gameRef = useRef<HideSeekGame | null>(null);
  const [name, setName] = useState(() => user?.username ?? localStorage.getItem('pv.hideseek.name') ?? '');
  const [code, setCode] = useState(() => (params.get('room') ?? '').toUpperCase());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [myId, setMyId] = useState('');
  const [online, setOnline] = useState(true);
  const [progress, setProgress] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [disguise, setDisguise] = useState<Kind>('vase');
  const [hasTarget, setHasTarget] = useState(false);
  const [lastEvent, setLastEvent] = useState<GameEvent | null>(null);
  const [character, setCharacter] = useState<CharacterId>(preferredCharacter);

  // Connect and join (or create) a room.
  const enter = useCallback(
    async (create: boolean) => {
      setBusy(true);
      setError(null);
      try {
        localStorage.setItem('pv.hideseek.name', name);
      } catch {
        /* not critical */
      }
      if (!netRef.current) {
        netRef.current = new HideSeekNet({
          onRoom: setRoom,
          onTick: (t) => gameRef.current?.applyTick(t),
          onEvent: (e) => {
            setLastEvent(e);
            if (e.type === 'join') message.info(`${e.name} joined`);
            if (e.type === 'leave') message.warning(`${e.name} left`);
            if (e.type === 'miss') message.warning(`${e.by} tagged the wrong object! −5 s`);
          },
          onStatus: setOnline,
        });
      }
      const res = await netRef.current.join(create ? { create: true, name } : { code, name });
      setBusy(false);
      if (!res.ok) return setError(res.error ?? 'Could not join.');
      setMyId(res.playerId!);
      setParams({ room: res.code! }, { replace: true });
    },
    [code, name, message, setParams],
  );

  // Auto-join from an invite link.
  useEffect(() => {
    if (params.get('room') && !netRef.current && (user?.username || name)) void enter(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => () => netRef.current?.dispose(), []);

  // The 3D museum, created once you're in a room.
  const inRoom = Boolean(myId);
  useEffect(() => {
    if (!inRoom || !stageRef.current) return;
    const game = new HideSeekGame(stageRef.current, {
      onProgress: setProgress,
      onTagResult: (r) => {
        if (!r.ok && r.reason) message.info(r.reason);
      },
    });
    gameRef.current = game;
    game.load().then(() => {
      if (!netRef.current) return;
      game.setSender(netRef.current);
      setLoaded(true);
    });
    return () => {
      game.dispose();
      gameRef.current = null;
    };
  }, [inRoom, message]);

  useEffect(() => {
    if (room && loaded) gameRef.current?.applyRoom(room, myId);
  }, [room, loaded, myId]);

  // Tick the countdown and the "something to tag" hint.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(netRef.current?.serverNow() ?? Date.now());
      setHasTarget(Boolean(gameRef.current?.hasTarget));
    }, 200);
    return () => window.clearInterval(id);
  }, []);

  const me = room?.players.find((p) => p.id === myId);
  const hider = room?.players.find((p) => p.id === room.hiderId);
  const iHide = Boolean(room && room.hiderId === myId && ['hide', 'seek', 'results'].includes(room.phase));
  const left = room ? room.endsAt - now : 0;
  const frozen = Boolean(me && me.frozenUntil > now);

  const pickDisguise = useCallback((k: Kind) => {
    setDisguise(k);
    gameRef.current?.setDisguise(k);
  }, []);

  // Keyboard.
  useEffect(() => {
    if (!inRoom) return;
    const held = new Set<string>();
    const sync = () => {
      const x = (held.has('arrowright') || held.has('d') ? 1 : 0) - (held.has('arrowleft') || held.has('a') ? 1 : 0);
      const z = (held.has('arrowup') || held.has('w') ? 1 : 0) - (held.has('arrowdown') || held.has('s') ? 1 : 0);
      gameRef.current?.setInput(x, z);
    };
    const down = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') return;
      const k = e.key.toLowerCase();
      if (['arrowleft', 'arrowright', 'arrowup', 'arrowdown', ' '].includes(k)) e.preventDefault();
      if ((k === 'e' || k === ' ') && !e.repeat) gameRef.current?.tagTarget();
      if (iHide && room?.phase === 'hide' && '1234'.includes(k)) pickDisguise(KINDS[Number(k) - 1]);
      held.add(k);
      sync();
    };
    const up = (e: KeyboardEvent) => {
      held.delete(e.key.toLowerCase());
      sync();
    };
    const blur = () => {
      held.clear();
      sync();
    };
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', blur);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', blur);
    };
  }, [inRoom, iHide, room?.phase, pickDisguise]);

  const invite = room ? `${window.location.origin}/play/museum-hide-seek?room=${room.code}` : '';
  const copyInvite = () => {
    void navigator.clipboard?.writeText(invite).then(() => message.success('Invite link copied'));
  };
  const start = async () => {
    const res = await netRef.current?.start();
    if (res && !res.ok) message.warning(res.error);
  };

  const players = [...(room?.players ?? [])].sort((a, b) => b.score - a.score);
  const scoreboard = (
    <ol className="hs-scores">
      {players.map((p, i) => (
        <li key={p.id} className={p.connected ? '' : 'gone'}>
          <span className="dot" style={{ background: p.color }} />
          <span className="who">
            {p.name}
            {p.id === myId && <Tag className="you">You</Tag>}
            {p.id === room?.hostId && <Tooltip title="Host"><CrownFilled className="host" /></Tooltip>}
          </span>
          <b>{p.score}</b>
          {room?.phase === 'final' && i === 0 && p.score > 0 && <span aria-label="Winner"> 🏆</span>}
        </li>
      ))}
    </ol>
  );

  // ----- Menu: choose a name, create or join.
  if (!inRoom) {
    return (
      <div className="play-page hs-menu">
        <div className="game-topbar">
          <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} aria-label="Back to games" />
        </div>
        <div className="overlay">
          <div className="panel">
            {closeButton}
            <Tag color="cyan">Online multiplayer · 2–8 players</Tag>
            <h1 className="game-title small">Museum Hide &amp; Seek</h1>
            <p className="lead">One player disguises as a museum object: a vase, a marble bust, a bench or a plant. Everyone else has two minutes to find them. Take turns until everyone has hidden once.</p>
            <Space orientation="vertical" size="middle" style={{ width: '100%', maxWidth: 380 }}>
              {!user && (
                <Input size="large" placeholder="Your name" maxLength={16} value={name} onChange={(e) => setName(e.target.value)} aria-label="Your name" />
              )}
              {user && <p className="muted" style={{ margin: 0 }}>Playing as <b>{user.username}</b>. Scores are saved to the leaderboard.</p>}
              <CharacterPicker value={character} onChange={setCharacter} />
              <Button type="primary" size="large" block icon={<PlusOutlined />} loading={busy} disabled={!user && !name.trim()} onClick={() => enter(true)}>
                Create a room
              </Button>
              <Space.Compact style={{ width: '100%' }}>
                <Input size="large" placeholder="Room code" maxLength={4} value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} aria-label="Room code" style={{ textTransform: 'uppercase', letterSpacing: '0.2em' }} />
                <Button size="large" icon={<LoginOutlined />} loading={busy} disabled={code.length !== 4 || (!user && !name.trim())} onClick={() => enter(false)}>
                  Join
                </Button>
              </Space.Compact>
              {busy && <p className="muted" style={{ margin: 0 }}>Connecting… the first visit after a quiet spell can take up to a minute while the game server wakes up.</p>}
              {error && <Alert type="error" showIcon title={error} />}
            </Space>
          </div>
        </div>
      </div>
    );
  }

  // ----- In a room.
  const phase = room?.phase ?? 'lobby';
  return (
    <div className="play-page">
      <div ref={stageRef} className="game-stage" />

      <div className="game-topbar">
        <Button shape="circle" icon={<ArrowLeftOutlined />} onClick={() => navigate('/')} aria-label="Leave the room" />
        <div className="hs-banner">
          {phase === 'hide' && (iHide ? <>You’re hiding! Pick a disguise and find a spot · <b>{clock(left)}</b></> : <>{hider?.name} is hiding · <b>{clock(left)}</b></>)}
          {phase === 'seek' && (iHide ? <>Stay still… they’re looking for you · <b>{clock(left)}</b></> : <>Find {hider?.name}! · <b>{clock(left)}</b></>)}
          {(phase === 'lobby' || phase === 'final') && <>Room <b>{room?.code}</b></>}
          {phase === 'results' && <>Round {room?.round} of {room?.rounds} over</>}
        </div>
        <div className="hs-side">{scoreboard}</div>
      </div>

      {!loaded && (
        <div className="overlay">
          <div className="panel narrow">
            <h2>Opening the museum…</h2>
            <Progress percent={Math.round(progress * 100)} strokeColor={{ from: '#4fc3f7', to: '#b39ddb' }} />
          </div>
        </div>
      )}

      {!online && (
        <div className="overlay">
          <div className="panel narrow">
            <h2>Reconnecting…</h2>
            <p className="muted">Your place in the room is kept for a minute.</p>
          </div>
        </div>
      )}

      {loaded && (phase === 'lobby' || phase === 'final') && (
        <div className="overlay overlay-low">
          <div className="panel briefing">
            <p className="eyebrow">{phase === 'final' ? 'Final scores' : 'Waiting for players'}</p>
            <h2 className="hs-code">
              Room {room?.code}
              <Tooltip title="Copy invite link">
                <Button shape="circle" icon={<CopyOutlined />} onClick={copyInvite} aria-label="Copy invite link" />
              </Tooltip>
            </h2>
            {phase === 'final' ? scoreboard : (
              <div className="hs-lobby-players">
                {room?.players.filter((p) => p.connected).map((p) => (
                  <span key={p.id} className="hs-chip" style={{ borderColor: p.color }}>
                    <Avatar size="small" className="emoji-avatar">{AVATARS[p.avatar] ?? '🙂'}</Avatar> {p.name}
                    {p.id === room.hostId && <CrownFilled className="host" />}
                  </span>
                ))}
              </div>
            )}
            <p className="lead small">Send the invite link to friends, or open it in another browser tab or on your phone to try it yourself. Walk around with WASD while you wait.</p>
            {room?.hostId === myId ? (
              <Button type="primary" size="large" icon={<CaretRightOutlined />} className="big-btn" onClick={start} disabled={(room?.players.filter((p) => p.connected).length ?? 0) < 2}>
                {phase === 'final' ? 'Play again' : 'Start the game'}
              </Button>
            ) : (
              <p className="muted">Waiting for {room?.players.find((p) => p.id === room.hostId)?.name ?? 'the host'} to start…</p>
            )}
          </div>
        </div>
      )}

      {loaded && phase === 'hide' && !iHide && (
        <div className="overlay hs-blindfold">
          <div className="panel narrow">
            <EyeInvisibleOutlined style={{ fontSize: 40 }} />
            <h2>Eyes closed!</h2>
            <p className="lead">{hider?.name} is choosing a disguise and a hiding spot.</p>
            <div className="hs-count">{clock(left)}</div>
          </div>
        </div>
      )}

      {loaded && iHide && phase === 'hide' && (
        <div className="hs-picker" role="radiogroup" aria-label="Choose a disguise">
          {KINDS.map((k, i) => (
            <button key={k} role="radio" aria-checked={disguise === k} className={disguise === k ? 'on' : ''} onClick={() => pickDisguise(k)}>
              <span className="icon">{KIND_ICONS[k]}</span>
              {KIND_LABELS[k]}
              <kbd>{i + 1}</kbd>
            </button>
          ))}
        </div>
      )}

      {loaded && phase === 'seek' && !iHide && (
        <div className="hs-hint">
          {frozen ? 'Wrong object! Frozen for a moment…' : hasTarget ? 'Press E (or tap Tag) to tag the glowing object' : 'Walk up to objects. One of them is a player.'}
          {touchDevice && <Button type="primary" size="large" disabled={!hasTarget || frozen} onClick={() => gameRef.current?.tagTarget()}>Tag</Button>}
        </div>
      )}

      {loaded && phase === 'results' && (
        <div className="overlay">
          <div className="panel narrow">
            {lastEvent?.type === 'found' ? (
              <>
                <p className="eyebrow">Found!</p>
                <h2>{lastEvent.by} found {lastEvent.name}</h2>
                <p className="muted">+{lastEvent.points} points</p>
              </>
            ) : lastEvent?.type === 'timeup' ? (
              <>
                <p className="eyebrow">Time’s up</p>
                <h2>{lastEvent.name} stayed hidden!</h2>
                <p className="muted">+{lastEvent.points} points</p>
              </>
            ) : (
              <h2>Round over</h2>
            )}
            {scoreboard}
            <p className="muted">Next round in {clock(left)}</p>
          </div>
        </div>
      )}

      {loaded && touchDevice && phase !== 'lobby' && <Joystick onMove={(x, z) => gameRef.current?.setInput(x, z)} />}
    </div>
  );
}

function Joystick({ onMove }: { onMove: (x: number, z: number) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const move = (e: React.PointerEvent) => {
    const rect = ref.current!.getBoundingClientRect();
    let dx = e.clientX - (rect.left + rect.width / 2);
    let dy = e.clientY - (rect.top + rect.height / 2);
    const max = rect.width / 2 - 18;
    const len = Math.hypot(dx, dy);
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    onMove(dx / max, -dy / max);
  };
  const release = () => {
    setKnob({ x: 0, y: 0 });
    onMove(0, 0);
  };
  return (
    <div className="touch-controls">
      <div ref={ref} className="touch-pad" onPointerDown={(e) => { (e.target as HTMLElement).setPointerCapture(e.pointerId); move(e); }} onPointerMove={(e) => e.buttons && move(e)} onPointerUp={release} onPointerCancel={release}>
        <div className="touch-knob" style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }} />
      </div>
    </div>
  );
}
