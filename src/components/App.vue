<template>
  <div class="container">
    <Terminal />
  </div>
</template>

<script setup>
import Terminal from '../xterm/Terminal.vue'
</script>

<style scoped>
.container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}
</style>