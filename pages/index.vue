<template>
  <div>
    <input
      v-model="Id"
      placeholder="Enter Global ID"
      class="border mb-2 p-2 rounded"
    />
    <button @click="setGlobalId" class="bg-blue-500 p-2 rounded text-white">
      Set Global ID
    </button>
    <codeMirror v-if="globalId" :userid="globalId"></codeMirror>
  </div>
</template>
<script setup>
import { ref } from "vue";

const globalId = ref(null);
const Id = ref(null);

function setGlobalId() {
  globalId.value = Id.value;
  console.log("Global ID set to:", globalId.value);
}
</script>
