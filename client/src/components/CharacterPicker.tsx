import { CHARACTERS, setPreferredCharacter, type CharacterId } from '../games/shared/hero';

/** Two picture tiles to choose who you play as. The choice is shared by every game. */
export default function CharacterPicker({ value, onChange }: { value: CharacterId; onChange: (id: CharacterId) => void }) {
  return (
    <div className="char-picker" role="radiogroup" aria-label="Choose your character">
      <span className="char-label">Character</span>
      {CHARACTERS.map((c) => (
        <button
          key={c.id}
          type="button"
          role="radio"
          aria-checked={value === c.id}
          className={`char-tile ${value === c.id ? 'on' : ''}`}
          title={c.blurb}
          onClick={() => {
            if (value === c.id) return;
            setPreferredCharacter(c.id);
            onChange(c.id);
          }}
        >
          <img src={c.thumb} alt="" width={40} height={50} />
          <span>{c.name}</span>
        </button>
      ))}
    </div>
  );
}
