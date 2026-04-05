function LandingPage({
  entryError,
  isTeachersLoading,
  logoSrc,
  onEnter,
  onRetryTeachers,
  onTeacherInputChange,
  teacherInput,
  teachersError,
}) {
  function handleSubmit(event) {
    event.preventDefault();
    onEnter();
  }

  return (
    <main className="page-shell page-shell--landing">
      <section className="landing-flow">
        {logoSrc ? <img alt="Aren Academy logosu" className="academy-logo--landing" src={logoSrc} /> : null}

        <div className="landing-flow__copy">
          <span className="landing-flow__eyebrow">Öğretmen girişi</span>
          <h1 className="landing-flow__title">Adınızı girin</h1>
          {isTeachersLoading ? <span className="landing-flow__status">Öğretmenler kontrol ediliyor...</span> : null}
        </div>

        <form className="entry-form landing-flow__form" onSubmit={handleSubmit}>
          <label className="field">
            <span className="sr-only">Öğretmen adı</span>
            <input
              aria-label="Öğretmen adı"
              autoComplete="name"
              className="field-input"
              onChange={(event) => onTeacherInputChange(event.target.value)}
              placeholder="Öğretmen adı"
              type="text"
              value={teacherInput}
            />
          </label>

          {entryError ? <p className="form-error">{entryError}</p> : null}
          {teachersError ? <p className="form-error">{teachersError}</p> : null}

          <div className="entry-actions landing-flow__actions">
            <button className="button button-primary" disabled={isTeachersLoading} type="submit">
              {isTeachersLoading ? 'Yükleniyor...' : 'Giriş'}
            </button>

            {teachersError ? (
              <button className="button button-ghost" onClick={onRetryTeachers} type="button">
                Tekrar dene
              </button>
            ) : null}
          </div>
        </form>
      </section>
    </main>
  );
}

export default LandingPage;
