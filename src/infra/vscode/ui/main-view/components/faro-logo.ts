import React from "react";

import { h } from "../react-helpers.ts";

export function FaroLogo(): React.ReactElement {
  return h(
    "svg",
    {
      className: "home-logo",
      viewBox: "0 0 256 256",
      fill: "none",
      xmlns: "http://www.w3.org/2000/svg",
      "aria-label": "Faro logo",
      role: "img",
    },
    h("rect", {
      x: "10",
      y: "10",
      width: "236",
      height: "236",
      rx: "58",
      stroke: "#3C5A74",
      strokeWidth: "6",
    }),
    h(
      "g",
      { transform: "translate(128 128) scale(1.3) translate(-128 -128)" },
      h("path", {
        d: "M86 92L128 70L170 92L170 140L128 162L86 140Z",
        stroke: "#67D2FF",
        strokeWidth: "7",
        strokeLinejoin: "round",
      }),
      h("path", {
        d: "M86 140L128 118L170 140",
        stroke: "#67D2FF",
        strokeWidth: "7",
      }),
      h("circle", { cx: "86", cy: "92", r: "7", fill: "#67D2FF" }),
      h("circle", { cx: "128", cy: "70", r: "7", fill: "#67D2FF" }),
      h("circle", { cx: "170", cy: "92", r: "7", fill: "#67D2FF" }),
      h("circle", { cx: "86", cy: "140", r: "7", fill: "#67D2FF" }),
      h("circle", { cx: "128", cy: "118", r: "7", fill: "#67D2FF" }),
      h("circle", { cx: "170", cy: "140", r: "7", fill: "#67D2FF" }),
      h("path", { d: "M128 82L140 102H116Z", fill: "#F4F7FB" }),
      h("rect", { x: "117", y: "102", width: "22", height: "16", rx: "6", fill: "#F4F7FB" }),
      h("path", { d: "M113 118H143L151 184H105Z", fill: "#F4F7FB" }),
      h("path", {
        d: "M102 186H154",
        stroke: "#F4F7FB",
        strokeWidth: "9",
        strokeLinecap: "round",
      }),
    ),
  );
}
