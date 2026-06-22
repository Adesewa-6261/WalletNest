"use client";

import { useState } from "react";

interface Props {
  onAdd: (address: string) => void;
  loading: boolean;
}

export default function AddressInput({ onAdd, loading }: Props) {
  const [value, setValue] = useState("");

  function submit() {
    if (!value.trim()) return;
    onAdd(value);
    setValue("");
  }

  return (
    <div className="add-bar">
      <input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && submit()}
        placeholder="Paste a wallet address (0x…) and press Enter"
        spellCheck={false}
        autoComplete="off"
      />
      <button className="btn" onClick={submit} disabled={loading}>
        {loading ? "Loading…" : "Add wallet"}
      </button>
    </div>
  );
}
