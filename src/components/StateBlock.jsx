function LoadingCards() {
  return (
    <div className="stack-grid">
      {[0, 1, 2].map((item) => (
        <div className="skeleton-card" key={item}>
          <div className="skeleton-line skeleton-line--short" />
          <div className="skeleton-line" />
          <div className="skeleton-line skeleton-line--medium" />
        </div>
      ))}
    </div>
  );
}

function StateBlock({ emptyMessage, emptyTitle, error, onRetry, state, children }) {
  if (state.status === 'loading') {
    return <LoadingCards />;
  }

  if (state.status === 'error') {
    return (
      <div className="state-card">
        <h3>Bir sorun oluştu</h3>
        <p>{error || state.error}</p>
        {onRetry ? (
          <button className="button button-ghost" onClick={onRetry} type="button">
            Tekrar dene
          </button>
        ) : null}
      </div>
    );
  }

  if (state.status === 'success' && state.data.length === 0) {
    return (
      <div className="state-card">
        <h3>{emptyTitle}</h3>
        <p>{emptyMessage}</p>
      </div>
    );
  }

  return children;
}

export default StateBlock;
