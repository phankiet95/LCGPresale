<script setup lang="ts">
useHead({ title: 'Weekly Report · LCG Opportunity' })
</script>

<template>
  <div class="page-head"><div><h1>Weekly Report</h1><div class="sub">SRS §7.1 — planned for the next iteration</div></div></div>
  <div class="card stack">
    <p style="margin: 0">Not built yet. It will reuse the same filters and rules as the Dashboard:</p>
    <ol style="margin: 0; padding-left: 20px; line-height: 1.8">
      <li>Weekly summary (new / won / lost in the week, pipeline, weighted) + Δ vs last week from <code>weekly_snapshots</code></li>
      <li>Highlight (SRS 5.7) · 3. Market health with % Green, % Verified · 4. Warning list W1–W7</li>
      <li>Top management concerns (&gt; $200K) · 6. Recommendations (stored per week + market) · 7. Project vs License</li>
    </ol>
    <p class="muted small" style="margin: 0">The database tables (<code>weekly_snapshots</code>, <code>weekly_recommendations</code>) already exist in migration 0000.</p>
  </div>
</template>
