<template>
  <div>
    {{ title }}
    <div>
      <Count></Count>
    </div>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'
import Count from 'app-b/components/count';

const title = ref('hello world')
</script>

<style scoped>

</style>