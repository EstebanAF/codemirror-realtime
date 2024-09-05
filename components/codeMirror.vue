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
import supabase from "~/supabase";

let { data: files, error } = await supabase
  .from("files")
  .select("*")
  .eq("github_repo_name", "manifest-project-CFE9NU")
  .eq("branch", "main")
  .eq("file_path", "api/index.js");
console.log(files);
// The updates received so far (updates.length gives the current
// version)
let updates = [];
// The current document
let doc = Text.of(["Start document"]);

//!authorityMessage

let pending = [];

function createConnectionWorker() {
  if (typeof Worker !== "undefined") {
    const worker = new Worker(new URL("../worker/worker.js", import.meta.url));
    worker.onmessage = (event) => {
      console.log(event.data);
      function resp(value) {
        event.ports[0].postMessage(JSON.stringify(value));
      }
      let data = JSON.parse(event.data);
      if (data.type == "pullUpdates") {
        if (data.version < updates.length) resp(updates.slice(data.version));
        else pending.push(resp);
      } else if (data.type == "pushUpdates") {
        // Convert the JSON representation to an actual ChangeSet
        // instance
        let received = data.updates.map((json) => ({
          clientID: json.clientID,
          changes: ChangeSet.fromJSON(json.changes),
        }));
        if (data.version != updates.length)
          received = rebaseUpdates(received, updates.slice(data.version));
        for (let update of received) {
          updates.push(update);
          doc = update.changes.apply(doc);
        }
        resp(true);
        if (received.length) {
          // Notify pending requests
          let json = received.map((update) => ({
            clientID: update.clientID,
            changes: update.changes.toJSON(),
          }));
          while (pending.length) pending.pop()(json);
        }
      } else if (data.type == "getDocument") {
        console.log({ version: updates.length, doc: doc.toString() });
        resp({ version: updates.length, doc: doc.toString() });
      }
    };
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

async function pushUpdates(connection, version, updates) {
  connection.postMessage({ type: "pushUpdates", payload: { updates } });

  return new Promise((resolve) => {
    connection.onmessage = (event) => {
      if (event.data.type === "updatesPushed") {
        resolve(true);
      }
    };
  });
}

async function pullUpdates(connection, version) {
  connection.postMessage({
    type: "pullUpdates",
    payload: { fromVersion: version },
  });

  return new Promise((resolve) => {
    connection.onmessage = (event) => {
      if (event.data.type === "updates") {
        resolve(event.data.payload);
      }
    };
  });
}

function peerExtension(startVersion, connection) {
  let done = false;

  const plugin = {
    view: null,
    pushingUpdates: false,

    init(view) {
      this.view = view;
      this.pull();
    },

    async pull() {
      const version = getSyncedVersion(this.view.state);
      const updates = await pullUpdates(connection, version);
      this.view.dispatch(receiveUpdates(this.view.state, updates));

      if (!done) {
        setTimeout(this.pull.bind(this), 5000); // Polling every 5 seconds
      }
    },

    async push() {
      const updates = sendableUpdates(this.view.state);
      if (this.pushingUpdates || !updates.length) return;

      this.pushingUpdates = true;
      const version = getSyncedVersion(this.view.state);
      await pushUpdates(connection, version, updates);
      this.pushingUpdates = false;

      if (sendableUpdates(this.view.state).length) {
        this.push();
      }
    },

    update(update) {
      if (update.docChanged) {
        this.push();
      }
    },

    destroy() {
      done = true;
    },
  };

  return [collab({ startVersion }), plugin];
}

const editor = ref(null);
const editorContainer = ref(null);

async function initializeEditor() {
  console.log("doc");
  const { version, doc } = await getDocument(connection);
  console.log(doc);
  const state = EditorState.create({
    doc,
    extensions: [basicSetup], // peerExtension(version, connection)],
  });
  new EditorView({
    state,
    parent: editorContainer.value,
  });
  console.log(editorContainer.value);
}

const connection = new Connection(worker, () => 100);
onMounted(async () => {
  // const { version, doc } = await getDocument(connection);
  // console.log("hola", doc);
  initializeEditor();
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
