<template>
  <div class="auth">
    <div class="auth-card card">
      <div class="brand">
        <div class="logo">LCG</div>
        <div><div class="b1">Opportunity Management</div><div class="b2">LCG pre-sale pipeline</div></div>
      </div>
      <slot />
    </div>
  </div>
</template>

<style scoped>
.auth { min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 16px; }
.auth-card { width: 100%; max-width: 400px; padding: 28px; display: flex; flex-direction: column; gap: 20px; }
.brand { display: flex; gap: 12px; align-items: center; }
.logo { width: 40px; height: 40px; border-radius: 10px; background: var(--primary); color: #fff; font-weight: 700; display: flex; align-items: center; justify-content: center; }
.b1 { font-weight: 700; font-size: 16px; }
.b2 { font-size: 13px; color: var(--muted); }
</style>
