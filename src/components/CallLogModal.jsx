function CallLogModal({ noteValue, onNoteChange, onNoteSave, saveState }) {
  const statusText = saveState.error
    || saveState.message
    || (saveState.status === 'loading' ? 'Not kaydediliyor...' : '');
  const debugDetails = saveState.debugDetails;

  return (
    <section
      className={`call-note-inline ${saveState.status === 'loading' ? 'call-note-inline--saving' : ''}`}
      onClick={(event) => event.stopPropagation()}
    >
      <textarea
        className="field-input field-input--textarea call-note-inline__textarea"
        onBlur={(event) => onNoteSave(event.target.value)}
        onChange={(event) => onNoteChange(event.target.value)}
        placeholder="Notunuzu buraya yazın"
        rows="2"
        value={noteValue}
      />
      <div className="call-note-inline__footer">
        {statusText ? (
          <p className={`call-note-inline__status call-note-inline__status--${saveState.status}`}>
            {statusText}
          </p>
        ) : <span />}
        <button
          className="call-note-inline__save"
          disabled={saveState.status === 'loading'}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onNoteSave(noteValue)}
          type="button"
        >
          Kaydet
        </button>
      </div>
      {debugDetails ? (
        <div className="call-note-inline__debug">
          <span>teacherName used: {debugDetails.teacherName || '-'}</span>
          <span>studentName used: {debugDetails.studentName || '-'}</span>
          <span>phoneNumber used: {debugDetails.phoneNumber || '-'}</span>
          <span>weekKey used: {debugDetails.weekKey || '-'}</span>
          <span>
            last Supabase result/error:{' '}
            {debugDetails.lastSupabaseError || debugDetails.lastSupabaseResult || 'No result yet'}
          </span>
        </div>
      ) : null}
    </section>
  );
}

export default CallLogModal;
