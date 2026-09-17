export function Mark({ size = 22 }: { size?: number }) {
  return (
    <svg class="brand__mark" width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" focusable="false">
      <path d="M4 26h7v-7h7v-7h7V5" fill="none" stroke="#0F6F6C" stroke-width="3" stroke-linecap="square" />
    </svg>
  );
}

export function Header() {
  return (
    <header>
      <div class="topbar">
        <a class="brand" href="./" aria-label="Operating Leverage Lab home">
          <Mark />
          <span class="brand__name">Operating Leverage Lab</span>
        </a>
        <div class="note" role="note">
          <strong>Assumption-based comparison</strong>
          Every number on this page is produced from the inputs you can see. Nothing here is a measured customer result, a
          benchmark or a guarantee.
        </div>
      </div>
      <div class="hero">
        <h1>What changes in cash. What changes in capacity.</h1>
        <div class="hero__aside">
          <p>
            Compare one process before and after an automation change. The answer comes back as three separate results: cash that
            actually moves, hours that come free, and, only if you model it, spending you might not have to make. They are never
            added together.
          </p>
        </div>
      </div>
    </header>
  );
}
