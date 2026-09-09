export function RuntimeInspector() {
  return (
    <section aria-label="Runtime data details">
      <span className="authoring-ui-badge">RUNTIME · READ-ONLY</span>
      <h3>Players</h3>
      <p>
        The authoritative running session supplies joined participants. Authors can reference this
        collection but cannot edit its contents.
      </p>
    </section>
  );
}
