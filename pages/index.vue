<template>
  <div>
    <input
      v-model="globalId"
      placeholder="Enter Global ID"
      class="border mb-2 p-2 rounded"
    />
    <button @click="setGlobalId" class="bg-blue-500 p-2 rounded text-white">
      Set Global ID
    </button>
    <codeMirror></codeMirror>
  </div>
</template>
<script setup>
import { ref } from "vue";

const globalId = ref(null);

function setGlobalId() {
  console.log("Global ID set to:", globalId.value);
}
</script>
