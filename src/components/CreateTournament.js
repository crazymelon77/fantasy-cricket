import React, { useState } from "react";
import { db } from "../firebase";
import { collection, addDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";

const CreateTournament = () => {
  const navigate = useNavigate();
  const [name, setName] = useState("");

  const handleCreate = async () => {
    if (!name) {
      alert("Tournament name required");
      return;
    }

    try {
      const tournamentRef = await addDoc(collection(db, "tournaments"), {
        name: name,
		active: false
      });

      console.log("✅ Tournament created:", tournamentRef.id);
      navigate(`/edit-tournament/${tournamentRef.id}`); // go straight to edit
    } catch (err) {
      console.error("❌ Error creating tournament:", err);
      alert("Failed to create tournament: " + err.message);
    }
  };

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Create Tournament</h1>

      <div className="mb-4">
        <label className="block mb-1">Tournament Name</label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="border px-2 py-1 rounded w-full"
        />
      </div>

      <button
        onClick={handleCreate}
        className="bg-green-500 text-white px-4 py-2 rounded"
      >
        Create Tournament
      </button>
    </div>
  );
};

export default CreateTournament;
