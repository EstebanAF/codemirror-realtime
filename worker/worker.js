// @standalone

//!authorityState

import { ChangeSet, Text } from "@codemirror/state";
import { rebaseUpdates } from "@codemirror/collab";
// The updates received so far (updates.length gives the current
// version)
let updates = [];

// The current document

let doc;

//!authorityMessage

let pending = [];

onmessage = (event) => {
  console.log("testup", updates);
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
    console.log("rec", received);
    if (data.version != updates.length) {
      received = rebaseUpdates(received, updates.slice(data.version));
      console.log("received ", received);
    }
    for (let update of received) {
      updates.push(update);
      doc = update.changes.apply(doc);
    }
    resp(updates);
    if (received.length) {
      // Notify pending requests
      let json = received.map((update) => ({
        clientID: update.clientID,
        changes: update.changes.toJSON(),
      }));
      while (pending.length) pending.pop()(json);
    }
  } else if (data.type == "getDocument") {
    resp({ version: updates.length, doc: doc.toString() });
  } else if (data.type == "initDoc") {
    doc = Text.of(data.doc.split("\n"));
    updates = data.updates;
    resp(true);
  } else if (data.type == "pushRealtime") {
    let received = data.fullUpdates.slice(data.version).map((json) => ({
      clientID: json.clientID,
      changes: ChangeSet.fromJSON(json.changes),
    }));
    console.log("rec", received);
    if (data.version != data.fullUpdates.length) {
      received = rebaseUpdates(received, updates.slice(data.version));
      console.log("received ", received);
    }
    for (let update of received) {
      updates.push(update);
      doc = update.changes.apply(doc);
    }
    resp(updates);
    if (received.length) {
      // Notify pending requests
      let json = received.map((update) => ({
        clientID: update.clientID,
        changes: update.changes.toJSON(),
      }));
      while (pending.length) pending.pop()(json);
    }
  }
};
