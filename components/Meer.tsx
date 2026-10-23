"use client";

import { useState } from "react";
import { useStock } from "./StockApp";
import { Icon, type IconName } from "./Icons";
import Suppliers from "./Suppliers";
import Allergens from "./Allergens";
import Logboek from "./Logboek";
import Telling from "./Telling";

export type MeerView = "menu" | "leveranciers" | "allergenen" | "logboek" | "telling";

export default function Meer({ initialView }: { initialView: MeerView }) {
  const { suppliers, products, openSettings } = useStock();
  const [view, setView] = useState<MeerView>(initialView);

  const back = (
    <button className="back" onClick={() => setView("menu")}>
      <Icon name="back" />
      Meer
    </button>
  );

  if (view === "leveranciers") return <div>{back}<Suppliers /></div>;
  if (view === "allergenen") return <div>{back}<Allergens /></div>;
  if (view === "logboek") return <div>{back}<Logboek /></div>;
  if (view === "telling") return <div>{back}<Telling /></div>;

  const withAllergens = products.filter((p) => p.allergens.length).length;
  const items: { id: MeerView | "instellingen"; icon: IconName; title: string; sub: string }[] = [
    { id: "telling", icon: "box", title: "Stock tellen", sub: "Per kant tellen wat er echt staat en de stock bijwerken" },
    {
      id: "leveranciers",
      icon: "truck",
      title: "Leveranciers",
      sub: suppliers.length ? `${suppliers.length} leveranciers · contact, besteldagen en deadlines` : "Contactgegevens, besteldagen en deadlines",
    },
    {
      id: "allergenen",
      icon: "alert",
      title: "Allergenen",
      sub: withAllergens ? `${withAllergens} van ${products.length} producten ingevuld` : "Per product de 14 allergenen opzoeken",
    },
    { id: "logboek", icon: "history", title: "Logboek", sub: "Wie heeft wat wanneer gedaan" },
    { id: "instellingen", icon: "gear", title: "Instellingen", sub: "Waarschuwing vervaldatum, jouw naam, uitloggen" },
  ];

  return (
    <div className="stack">
      <div>
        <h1 className="h1">Meer</h1>
      </div>
      <div className="list menu">
        {items.map((it) => (
          <div
            key={it.id}
            className="row click"
            role="button"
            tabIndex={0}
            onClick={() => (it.id === "instellingen" ? openSettings() : setView(it.id))}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (it.id === "instellingen") openSettings();
                else setView(it.id);
              }
            }}
          >
            <span className="menu-icon">
              <Icon name={it.icon} />
            </span>
            <div className="row-main">
              <div className="name">{it.title}</div>
              <div className="meta">{it.sub}</div>
            </div>
            <span className="chev">
              <Icon name="chevron" />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
