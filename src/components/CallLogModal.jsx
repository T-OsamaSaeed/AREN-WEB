function CallLogModal({ call, noteValue, onNoteChange, saveState }) {
  if (!call) {
    return null;
  }

  return (
    <section
      className={`call-note-inline ${saveState.status === 'loading' ? 'call-note-inline--saving' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        className="field-input field-input--textarea call-note-inline__textarea"
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Notunuzu buraya yazın"
        rows="2"
        value={noteValue}
      />
      {saveState.error ? <p className="form-error">{saveState.error}</p> : null}
    </section>
  );
}

export default CallLogModal;
