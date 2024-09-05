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
import { supabase, getFile } from "~/supabase";
import TestWorker from "~/worker/worker?worker";

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
      console.log("pay", payload);
      if (
        payload.eventType === "UPDATE" &&
        payload.new.file_path === "api/index.js" &&
        payload.new.github_repo_name === "manifest-project-CFE9NU" &&
        payload.new.branch === "main"
      ) {
        if (true) {
          const changes = ChangeSet.of([
            {
              from: 0,
              to: payload.new.content.length,
              insert: payload.new.content,
            },
          ]);
          console.log("realtime ", changes);
          const update = { clientID: "remote", changes };
          // this.view.dispatch(receiveUpdates(this.view.state, [update]));
          pushUpdates(connection, 1, [update]);
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

function pushUpdates(connection, version, fullUpdates) {
  // Strip off transaction data
  console.log("test", fullUpdates);
  let updates = fullUpdates.map((u) => ({
    clientID: u.clientID,
    changes: u.changes.toJSON(),
  }));
  return connection.request({ type: "pushUpdates", version, updates });
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
          setTimeout(() => this.push(), 100);
      }

      async pull() {
        while (!this.done) {
          let version = getSyncedVersion(this.view.state);
          let updates = await pullUpdates(connection, version);
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
  const { version } = await getDocument(connection);
  console.log(Text.of([await getFile()]));
  console.log(await getFile());
  const state = EditorState.create({
    doc: Text.of((await getFile()).split("\n")),
    extensions: [basicSetup, peerExtension(version, connection)],
  });
  new EditorView({
    state,
    parent: editorContainer.value,
  });
  console.log(editorContainer.value);
}

const connection = new Connection(worker, () => 100);
onMounted(async () => {
  initializeEditor();
  const content = await getFile();
  console.log({
    clientID: "admin",
    changes: [[content.length, ...content.split("\n")]],
  });
  console.log(editorContainer.value);
  // pushUpdates(connection, 12, [
  //   {
  //     clientID: "admin",
  //     changes: [content.length, ...content.split("\n")],
  //   },
  // ]);
  // const state = EditorState.create({
  //   doc: Text.of(["Start documen asdas t"]),
  //   extensions: [basicSetup],
  // });
  // new EditorView({
  //   state,
  //   parent: editorContainer.value,
  // });
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
