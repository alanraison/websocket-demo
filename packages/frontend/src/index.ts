import { select } from "d3-selection";
import "tailwindcss/tailwind.css";
import { PersonData, update } from "./plot";

const wsUrl = "wss://qqf3mheh50.execute-api.eu-west-2.amazonaws.com/default";
let ws: WebSocket;
let updatePlot: (data: Array<PersonData>) => void;

function webSocketUrl() {
  const url = new URL(wsUrl);
  const name = (document.getElementById("name") as HTMLInputElement).value;
  url.searchParams.append("name", name || "unknown");
  return url;
}

function addEventListeners(
  connectBtn: HTMLElement,
  disconnectBtn: HTMLElement
) {
  connectBtn.onclick = function connect() {
    ws = new WebSocket(webSocketUrl());
    ws.addEventListener("message", (ev) => {
      updatePlot(JSON.parse(ev.data).allPeople);
    });
    disconnectBtn.toggleAttribute("disabled");
    connectBtn.toggleAttribute("disabled");
  };
  disconnectBtn.onclick = function disconnect() {
    ws.close();
    updatePlot([]);
    connectBtn.toggleAttribute("disabled");
    disconnectBtn.toggleAttribute("disabled");
  };
}

document.addEventListener("DOMContentLoaded", () => {
  const connectBtn = document.getElementById("connect");
  const disconnectBtn = document.getElementById("disconnect");

  if (connectBtn && disconnectBtn) {
    addEventListeners(connectBtn, disconnectBtn);
  }

  const canvas = select("#d3")
    .append("svg")
    .attr("width", "100%")
    .attr("height", "100%")
    .append("g");

  updatePlot = update(canvas);
});
