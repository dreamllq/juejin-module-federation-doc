<template>
  <div>
    {{ title }}
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'

const title = ref('hello world')
</script>

<style scoped>

</style>