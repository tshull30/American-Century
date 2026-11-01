import { PAUSE_TAGS, type Autosave, type Settings } from "./settings";

const KEYS: [string, string][] = [
  ["Space", "Pause or resume"],
  ["1 to 5", "Set the speed"],
  ["+ and −", "Faster or slower"],
  [".", "Advance one day while paused"],
  ["[ and ]", "Previous or next tab"],
  ["?", "Open or close this panel"],
  ["Esc", "Close dialogs"],
];

export function SettingsDialog(p: { settings: Settings; onChange: (s: Settings) => void; onClose: () => void }) {
  const { settings: st, onChange } = p;
  return (
    <div className="modal-back" onClick={p.onClose}>
      <div className="modal settings" onClick={(e) => e.stopPropagation()} role="dialog" aria-label="Settings">
        <h3>Pause the game when</h3>
        {PAUSE_TAGS.map((t) => (
          <label key={t.tag} className="check">
            <input type="checkbox" checked={!!st.pause[t.tag]} onChange={(e) => onChange({ ...st, pause: { ...st.pause, [t.tag]: e.target.checked } })} />
            {t.label}
          </label>
        ))}
        <h3>Autosave</h3>
        <select value={st.autosave} onChange={(e) => onChange({ ...st, autosave: e.target.value as Autosave })}>
          <option value="month">Every month</option>
          <option value="quarter">Every quarter</option>
          <option value="year">Every January</option>
          <option value="off">Off</option>
        </select>
        <p className="hint">Saves go to this browser. Use Export to keep a copy somewhere else.</p>
        <h3>Keyboard</h3>
        <table className="keys"><tbody>
          {KEYS.map(([k, v]) => <tr key={k}><td><kbd>{k}</kbd></td><td>{v}</td></tr>)}
        </tbody></table>
        <div className="row" style={{ justifyContent: "flex-end", marginTop: 14 }}>
          <button className="primary" autoFocus onClick={p.onClose}>Done</button>
        </div>
      </div>
    </div>
  );
}
