<template>
  <div class="h-72 w-full" ref="editorContainer"></div>
</template>

<script setup>
import {
  receiveUpdates,
  sendableUpdates,
  collab,
  getSyncedVersion,
  rebaseUpdates,
} from "@codemirror/collab";
import { basicSetup } from "codemirror";
import { ChangeSet, EditorState, Text } from "@codemirror/state";
import { EditorView, ViewPlugin, ViewUpdate } from "@codemirror/view";
import { supabase, getFile, setUpdates } from "~/supabase";
import TestWorker from "~/worker/worker?worker";

const props = defineProps({
  userid: {
    type: String,
    required: true,
  },
});

function createConnectionWorker() {
  if (typeof Worker !== "undefined") {
    const worker = new TestWorker();
    console.log(worker);
    return worker;
  } else {
    console.error("Web Workers are not supported in this environment.");
    return null;
  }
}

function pause(time) {
  return new Promise((resolve) => setTimeout(resolve, time));
}

supabase
  .channel("custom-filter-channel")
  .on(
    "postgres_changes",
    {
      event: "*",
      schema: "public",
      table: "files",
      filter: "github_repo_name=eq.manifest-project-CFE9NU",
    },
    (payload) => {
      if (
        payload.eventType === "UPDATE" &&
        payload.new.file_path === "api/index.js" &&
        payload.new.github_repo_name === "manifest-project-CFE9NU" &&
        payload.new.branch === "main" &&
        payload.new.changesBy !== props.userid
      ) {
        if (true) {
          console.log("realtime ", payload.new.updates);
          // this.view.dispatch(receiveUpdates(this.view.state, [update]));
          pushUpdatesRealtime(connection, payload.new.updates);
        }
      }
    },
  )
  .subscribe();

class Connection {
  disconnected = null;

  constructor(worker, getLatency) {
    this.worker = worker;
    this.getLatency = getLatency;
  }

  _request(value) {
    return new Promise((resolve) => {
      let channel = new MessageChannel();
      channel.port2.onmessage = (event) => resolve(JSON.parse(event.data));
      this.worker.postMessage(JSON.stringify(value), [channel.port1]);
    });
  }

  async request(value) {
    let latency = this.getLatency();
    if (this.disconnected) await this.disconnected.wait;
    await pause(latency);
    let result = await this._request(value);
    if (this.disconnected) await this.disconnected.wait;
    await pause(latency);
    return result;
  }

  setConnected(value) {
    if (value && this.disconnected) {
      this.disconnected.resolve();
      this.disconnected = null;
    } else if (!value && !this.disconnected) {
      let resolve,
        wait = new Promise((r) => (resolve = r));
      this.disconnected = { wait, resolve };
    }
  }
}
const worker = createConnectionWorker();

function getDocument(connection) {
  return connection.request({ type: "getDocument" }).then((data) => ({
    version: data.version,
    doc: Text.of(data.doc.split("\n")),
  }));
}

function setDataWorker(connection, docContent, updates) {
  return connection.request({ type: "initDoc", doc: docContent, updates });
}

async function pushUpdates(connection, version, fullUpdates) {
  // Strip off transaction data
  console.log("test", fullUpdates);
  let updates = fullUpdates.map((u) => ({
    clientID: u.clientID,
    changes: u.changes.toJSON(),
  }));
  const allUpdates = await connection.request({
    type: "pushUpdates",
    version,
    updates,
  });
  const { doc } = await getDocument(connection);
  console.log(doc);
  setUpdates(allUpdates, doc.text.join("\n"), props.userid);
  return allUpdates;
}

async function pushUpdatesRealtime(connection, fullUpdates) {
  // Strip off transaction data
  console.log("test realtime", fullUpdates);

  const { doc, version } = await getDocument(connection);
  console.log("version", version);
  const allUpdates = await connection.request({
    type: "pushRealtime",
    version,
    fullUpdates,
  });
  //console.log(doc);
  //setUpdates(allUpdates, doc.text.join("\n"), props.userid);
  //console.log([versionlocal.value, allUpdates.length]);
  //versionlocal.value = allUpdates.length || 0;
  return allUpdates;
}
function pullUpdates(connection, version) {
  return connection.request({ type: "pullUpdates", version }).then((updates) =>
    updates.map((u) => ({
      changes: ChangeSet.fromJSON(u.changes),
      clientID: u.clientID,
    })),
  );
}

function peerExtension(startVersion, connection) {
  let plugin = ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.view = view;
        this.pushing = false;
        this.done = false;
        this.pull();
      }

      update(update) {
        if (update.docChanged) this.push();
      }

      async push() {
        let updates = sendableUpdates(this.view.state);
        // console.log("update:", updates);
        if (this.pushing || !updates.length) return;
        this.pushing = true;
        let version = getSyncedVersion(this.view.state);
        await pushUpdates(connection, version, updates);
        this.pushing = false;
        // Regardless of whether the push failed or new updates came in
        // while it was running, try again if there's updates remaining
        if (sendableUpdates(this.view.state).length)
          setTimeout(() => this.push(), 1000);
      }

      async pull() {
        while (true) {
          let version = getSyncedVersion(this.view.state);
          let updates = await pullUpdates(connection, version);
          console.log("pull", updates);
          this.view.dispatch(receiveUpdates(this.view.state, updates));
        }
      }

      destroy() {
        this.done = true;
      }
    },
  );
  return [collab({ startVersion }), plugin];
}

const editor = ref(null);
const editorContainer = ref(null);

async function initializeEditor() {
  console.log("doc");
  await setDataWorker(connection, ...(await getFile()));
  const { version, doc } = await getDocument(connection);
  const state = EditorState.create({
    doc,
    extensions: [basicSetup, peerExtension(version, connection)],
  });
  new EditorView({
    state,
    parent: editorContainer.value,
  });
}

const connection = new Connection(worker, () => 100);

onMounted(async () => {
  await initializeEditor();
});

onBeforeUnmount(() => {
  if (editor.value) {
    editorContainer.value.destroy();
  }
});
</script>

<style>
/* Your CSS styles if necessary */
</style>
