"use client";

import { useState } from "react";
import { changePin, setupPin, verifyPin } from "@/actions/pin";
import { weakPinReason } from "@/lib/pin-rules";
import { PinPad } from "./pin-pad";

// Choosing the first code: type it, type it again, saved.
export function PinSetupFlow({ onDone }: { onDone: () => void }) {
  const [first, setFirst] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();

  if (first === null) {
    return (
      <PinPad
        key="first"
        title="Kies een pincode"
        hint="6 cijfers. Hiermee ontgrendel je de app, ook als je telefoon al open is. Face ID kun je daarna als extra aanzetten."
        notice={notice}
        onComplete={async (pin) => {
          const weak = weakPinReason(pin);
          if (weak) return weak;
          setNotice(undefined);
          setFirst(pin);
          return null;
        }}
      />
    );
  }
  return (
    <PinPad
      key="again"
      title="Herhaal je pincode"
      hint="Type dezelfde 6 cijfers nog een keer."
      onComplete={async (pin) => {
        if (pin !== first) {
          setNotice("De twee pincodes waren niet gelijk. Kies opnieuw.");
          setFirst(null);
          return null;
        }
        const result = await setupPin(pin);
        if (result.error) return result.error;
        onDone();
        return null;
      }}
    />
  );
}

// Changing the code: the old one first, then the new one twice.
export function PinChangeFlow({ onDone, onCancel }: { onDone: () => void; onCancel: () => void }) {
  const [current, setCurrent] = useState<string | null>(null);
  const [first, setFirst] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | undefined>();

  if (current === null) {
    return (
      <PinPad
        key="current"
        title="Huidige pincode"
        hint="Voer eerst je huidige pincode in."
        onCancel={onCancel}
        onComplete={async (pin) => {
          const result = await verifyPin(pin);
          if (result.signedOut) {
            window.location.assign("/login");
            return null;
          }
          if (!result.ok) return result.error ?? "Onjuiste pincode.";
          setCurrent(pin);
          return null;
        }}
      />
    );
  }
  if (first === null) {
    return (
      <PinPad
        key="new"
        title="Nieuwe pincode"
        hint="Kies 6 nieuwe cijfers."
        notice={notice}
        onCancel={onCancel}
        onComplete={async (pin) => {
          const weak = weakPinReason(pin);
          if (weak) return weak;
          setNotice(undefined);
          setFirst(pin);
          return null;
        }}
      />
    );
  }
  return (
    <PinPad
      key="again"
      title="Herhaal de nieuwe pincode"
      onCancel={onCancel}
      onComplete={async (pin) => {
        if (pin !== first) {
          setNotice("De twee pincodes waren niet gelijk. Kies opnieuw.");
          setFirst(null);
          return null;
        }
        const result = await changePin(current, pin);
        if (result.signedOut) {
          window.location.assign("/login");
          return null;
        }
        if (result.error) return result.error;
        onDone();
        return null;
      }}
    />
  );
}
