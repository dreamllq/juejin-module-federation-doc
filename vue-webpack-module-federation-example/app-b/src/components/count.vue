<template>
  <div>
    <button @click="onClick">click</button>
    <p>
      {{ count }}
    </p>
  </div>
</template>

<script setup lang="ts">
import {ref} from 'vue'

const count = ref(0)

const onClick = ()=>{
  count.value ++;
}
</script>

<style lang="scss" scoped>

</style>