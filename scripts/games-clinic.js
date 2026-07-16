// 🩺 Boo-Boo Clinic — the BIG entertainment game: an endless, no-fail animal
// clinic plus a persistent meadow where every friend Josh has ever healed
// lives forever. Entertainment-first pretend play (Josh is the HELPER) built
// for 30+ minute self-directed sessions and return-across-days.
//
// DELIBERATE TEST-CONTRACT DEVIATION (documented per CLAUDE.md RULE 7):
// experimenting with a non-remedy tool is REWARDED with a funny class-based
// gag and NEVER invokes the framework's gentle-miss helper — in this game a
// wrong tap does not exist at all (the purest form of the no-fail law); a
// guardrail test enforces that this file never contains that call. The
// strict data-correct chain the generic harness follows is:
//   stethoscope → the remedy tool → N counted care-taps on the patient
//   → any sticker (all three are correct) → api.roundWin() (+ api.win() on
//   the first heal of a session).
// The meadow is built LAZILY on first door-tap so the clinic opens with ZERO
// [data-toy] elements — the harness must take the win path, not the toy path.
// Every next data-correct mounts synchronously in the tap that consumes the
// previous one (the harness wait-budget learning).
//
// World save: localStorage "josh-clinic-v1", owned EXCLUSIVELY by
// window.JoshClinic below (the JoshProgress/JoshBuddy one-owner pattern).
// Validation/migration is pure logic (JoshLogic.validateClinicStore) so a
// corrupt or future-versioned save can never crash the game — it just starts
// a fresh meadow. The grown-ups reset gate clears this key too.
//
// TONE LAW: boo-boos are silly (splotches, bubbles, stars, notes), never sad.
// Patients smile at all times — a guardrail test scans this file for sad
// faces and fails if one could ever render.
(function () {
  const F = window.JoshFramework;
  if (!F) return;

  // ---- JoshClinic: THE single owner of the "josh-clinic-v1" world save ----
  const KEY = "josh-clinic-v1";
  const TEST_DAY_KEY = "josh-test-day-offset"; // e2e time travel (test hook)
  const JoshClinic = {
    KEY,
    load() {
      let parsed = null;
      try { parsed = JSON.parse(localStorage.getItem(KEY)); } catch (e) { parsed = null; }
      const L = window.JoshLogic;
      const valid = parsed && L && L.validateClinicStore ? L.validateClinicStore(parsed) : null;
      return valid || { v: 1, healed: [], egg: null, hatched: [] };
    },
    save(world) {
      try { localStorage.setItem(KEY, JSON.stringify(world)); } catch (e) { /* storage may be unavailable */ }
    },
    today() {
      const L = window.JoshLogic;
      let off = 0;
      try { off = Number(localStorage.getItem(TEST_DAY_KEY)) || 0; } catch (e) { off = 0; }
      return (L && L.dayIndex ? L.dayIndex(new Date()) : 0) + off;
    },
    clear() {
      try { localStorage.removeItem(KEY); } catch (e) { /* ignore */ }
    },
  };
  window.JoshClinic = JoshClinic;

  F.register({
    id: "boo-boo-clinic",
    icon: "🩺",
    title: "Boo-Boo Clinic",
    skill: "pretend play / caring — the big game",
    start(api) {
      const C = api.C;
      const CL = C.CLINIC || { TOOLS: [], AILMENTS: [], STICKERS: [], TREATS: [], PATIENT_ANIMALS: [], HATCHLINGS: [] };
      const L = window.JoshLogic || {};
      const ART = window.JoshArt || {};
      const A = window.JoshAudio || { say() {}, isMuted: () => true };

      api.setPrompt("Doctor Josh! Who needs your help?", ["🚑", "🩺", "❤️"]);

      let world = JoshClinic.load();
      let wonThisSession = false;
      let lastPatient = null, lastClass = null;
      let round = null;           // { patient, ailments, variant, careTaps, ai, phase, misses }
      let treatSel = null;        // selected meadow treat (emoji)
      let meadowBuilt = false;

      // A generation token so a superseded session's timers go quiet (the
      // framework rebuilds the stage on Again/restart; old timers must not
      // speak or spawn patients from a dead round).
      const gen = String(Date.now()) + Math.random();
      api.stage.dataset.clinicGen = gen;
      const live = () => api.stage.dataset.clinicGen === gen;

      const speak = (t) => { if (live()) api.say(t); };
      const blip = (freq, opts) => {
        try { if (live() && A.tone && A.isMuted && !A.isMuted()) A.tone(freq, opts); } catch (e) { /* ignore */ }
      };

      // ---- shell: door + two rooms in one stage --------------------------
      const doorBtn = api.el("button", {
        class: "btn-round clinic__door", type: "button", text: "🌳",
        aria: { label: "Go to the meadow" },
        onclick: toggleRoom,
      });
      const top = api.el("div", { class: "clinic__top" }, [doorBtn]);
      const clinicRoom = api.el("div", { class: "clinic__room" });
      const meadowRoom = api.el("div", { class: "clinic__room", hidden: "" });
      api.stage.append(top, clinicRoom, meadowRoom);

      const toolFor = (ailmentId) => CL.TOOLS.find((t) => t.heals === ailmentId);
      const ailmentDef = (id) => CL.AILMENTS.find((a) => a.id === id);

      // The rotating friend who drives the ambulance (personalization, free).
      function ambulanceHtml(friend) {
        const svg = ART.ambulance ? ART.ambulance() : "";
        const face = friend && friend.art && ART.friend ? ART.friend(friend.art) : "";
        return '<span class="clinic__ambo-truck" aria-hidden="true">' + svg + "</span>" +
          (face ? '<span class="clinic__ambo-friend" aria-hidden="true">' + face + "</span>" : "");
      }

      function patientFace(p) {
        if (p.kind === "pup" && ART.pup) return '<span class="clinic__face clinic__face--art">' + ART.pup(p.collar || p.c) + "</span>";
        if (p.kind === "truck" && ART.truck) return '<span class="clinic__face clinic__face--art">' + ART.truck() + "</span>";
        if (p.kind === "hero" && ART.hero) return '<span class="clinic__face clinic__face--art">' + ART.hero(p.color || p.c) + "</span>";
        return '<span class="clinic__face">' + p.sp + "</span>";
      }

      // Patients who can visit right now. Everyone starts with the animal
      // friends + rescue pups; the rarer visitors (the little dump truck and
      // a hero) join the rotation once Josh is deep in a session (invisible
      // ramp — a longer visit just gets MORE kinds of patients).
      function roster() {
        const out = [];
        for (const sp of CL.PATIENT_ANIMALS) {
          const a = (C.ANIMALS || []).find((x) => x.emoji === sp);
          if (a) out.push({ sp: a.emoji, name: a.name, kind: "emoji", classes: null });
        }
        for (const pup of (C.PUPS || []).slice(0, 3)) {
          out.push({ sp: "pup:" + pup.name, name: pup.name, kind: "pup", collar: pup.collar, classes: ["ouchie", "dirty", "tangled"] });
        }
        if (api.shouldRamp(6)) {
          out.push({ sp: "truck", name: "Little Dump Truck", kind: "truck", classes: ["dirty", "tangled", "rumbly"] });
          const h = api.hero();
          out.push({ sp: "hero:" + h.name, name: h.name, kind: "hero", color: h.color, classes: ["ouchie", "dirty"] });
        }
        return out;
      }

      // ---- the clinic loop ------------------------------------------------
      function nextPatient() {
        if (!live()) return;
        round = L.makeClinicRound ? L.makeClinicRound({
          patients: roster(),
          classes: CL.AILMENTS.map((a) => a.id),
          lastPatient, lastClass,
          ailments: api.shouldRamp(6) && Math.random() < 0.35 ? 3 : api.shouldRamp(3) ? 2 : 1,
          maxCare: api.shouldRamp(3) ? 6 : 4,
        }, Math.random) : null;
        if (!round) return;
        lastPatient = round.patient.sp;
        lastClass = round.ailments[0];
        round.ai = 0;          // which ailment is being treated
        round.phase = "exam";  // exam → tool → care → sticker
        round.misses = 0;      // playful non-remedy taps (for the gentle hint)
        renderPatient();
        speak("Ding ding! Someone needs help!");
        blip(660, { duration: 0.18, gain: 0.18 });
      }

      let patientBtn, stethBtn, toolTray, stickerTray, pileEl, sceneEl;

      function renderPatient() {
        clinicRoom.innerHTML = "";
        const p = round.patient;

        sceneEl = api.el("div", { class: "clinic__scene" });
        const ambo = api.el("div", { class: "clinic__ambo", html: ambulanceHtml(api.friend()) });
        patientBtn = api.el("button", {
          class: "clinic__patient", type: "button",
          aria: { label: p.name },
        }, []);
        patientBtn.innerHTML = patientFace(p);
        for (const [i, ail] of round.ailments.entries()) {
          const ov = api.el("span", {
            class: "clinic__boo", dataset: { boo: ail },
            aria: { hidden: "true" },
            html: ART.booBoo ? ART.booBoo(ail, (round.variant + i) % 2) : "",
          });
          patientBtn.appendChild(ov);
        }
        patientBtn.addEventListener("click", onPatientTap);
        sceneEl.append(ambo, patientBtn);

        // The stethoscope: the one worked-example step (listen → the boo-boo
        // names itself). First-ever visit gets a bouncing 👉 demo hand.
        stethBtn = api.el("button", {
          class: "btn-big clinic__steth", type: "button",
          dataset: { correct: "1" },
          aria: { label: "Listen with the stethoscope" },
          onclick: onSteth,
        }, ["🩺 "]);
        if (!world.healed.length) {
          stethBtn.appendChild(api.el("span", { class: "clinic__demo", text: "👉", aria: { hidden: "true" } }));
        }

        pileEl = api.el("div", { class: "clinic__pile", aria: { hidden: "true" } });

        toolTray = api.el("div", { class: "choices choices--3 clinic__tray" });
        for (const tool of CL.TOOLS) {
          const b = api.el("button", {
            class: "choice clinic__tool", type: "button",
            dataset: { tool: tool.id },
            aria: { label: tool.name },
            onclick: () => onTool(tool),
          }, [tool.emoji]);
          toolTray.appendChild(b);
        }

        stickerTray = api.el("div", { class: "choices choices--3 clinic__stickers", hidden: "" });
        for (const st of CL.STICKERS) {
          stickerTray.appendChild(api.el("button", {
            class: "choice clinic__sticker", type: "button",
            aria: { label: "sticker" },
            onclick: () => onSticker(st),
          }, [st]));
        }

        clinicRoom.append(sceneEl, stethBtn, pileEl, toolTray, stickerTray);
      }

      function onSteth() {
        if (!round) return;
        stethBtn.removeAttribute("data-correct");
        const demo = stethBtn.querySelector(".clinic__demo");
        if (demo) demo.remove();
        // A comical heartbeat: two low thumps (fast ones for the hiccups).
        const fast = round.ailments[round.ai] === "hiccups";
        blip(110, { type: "sine", duration: 0.16, gain: 0.22 });
        setTimeout(() => blip(138, { type: "sine", duration: 0.16, gain: 0.22 }), fast ? 120 : 240);
        announceAilment();
        if (round.phase === "exam") {
          round.phase = "tool";
          armRemedy();
        }
      }

      function announceAilment() {
        const ail = ailmentDef(round.ailments[round.ai]);
        if (!ail) return;
        speak("Oh no! " + round.patient.name + " has " + ail.say + "!");
        const ov = patientBtn.querySelector('[data-boo="' + ail.id + '"]');
        if (ov) { ov.classList.remove("clinic__boo--pulse"); void ov.offsetWidth; ov.classList.add("clinic__boo--pulse"); }
      }

      function armRemedy() {
        const tool = toolFor(round.ailments[round.ai]);
        if (!tool) return;
        const btn = toolTray.querySelector('[data-tool="' + tool.id + '"]');
        if (btn) btn.dataset.correct = "1";
      }

      function onTool(tool) {
        if (!round) return;
        const active = round.ailments[round.ai];
        // The remedy arms the care phase ONLY from exam/tool (re-tapping it
        // mid-care must never reset the counted taps — it just gags instead).
        if (tool.heals === active && (round.phase === "exam" || round.phase === "tool")) {
          // The remedy! Move from the tray to counted care-taps on the patient.
          const btn = toolTray.querySelector('[data-tool="' + tool.id + '"]');
          if (btn) { btn.removeAttribute("data-correct"); btn.classList.remove("clinic__tool--hint"); }
          if (round.phase === "exam") { // he found it before listening — fine!
            stethBtn.removeAttribute("data-correct");
            const demo = stethBtn.querySelector(".clinic__demo");
            if (demo) demo.remove();
          }
          round.phase = "care";
          round.tapsLeft = round.careTaps;
          round.careTool = tool;
          patientBtn.dataset.correct = "1";
          patientBtn.dataset.tapsLeft = String(round.tapsLeft);
          pileEl.textContent = "";
          for (let i = 0; i < round.tapsLeft; i++) {
            pileEl.appendChild(api.el("span", { class: "clinic__pip", text: tool.careIcon }));
          }
          speak(tool.careSay + " " + tool.careSay);
          blip(520, { duration: 0.2, gain: 0.2 });
        } else {
          // A playful experiment — ALWAYS rewarded, NEVER a fail (no bump, no
          // miss call, the streak is untouched). This is the comedy engine.
          round.misses++;
          gag(tool);
          if (round.misses >= 4 && round.phase === "tool") {
            const remedy = toolFor(active);
            const btn = remedy && toolTray.querySelector('[data-tool="' + remedy.id + '"]');
            if (btn) btn.classList.add("clinic__tool--hint"); // a glow, never a scold
          }
        }
      }

      function gag(tool) {
        api.tickPlay(); // observable playfulness (and provably not a fail)
        const burst = api.el("span", { class: "clinic__gag", text: tool.gagIcon, aria: { hidden: "true" } });
        patientBtn.appendChild(burst);
        setTimeout(() => burst.remove(), 1400);
        patientBtn.classList.remove("clinic__patient--giggle");
        void patientBtn.offsetWidth;
        patientBtn.classList.add("clinic__patient--giggle");
        speak(tool.gagSay);
        blip(740, { duration: 0.14, gain: 0.16 });
        setTimeout(() => blip(880, { duration: 0.14, gain: 0.14 }), 110);
      }

      function onPatientTap() {
        if (!round) return;
        if (round.phase !== "care") {
          // Petting the patient is always friendly (still not a fail).
          patientBtn.classList.remove("clinic__patient--giggle");
          void patientBtn.offsetWidth;
          patientBtn.classList.add("clinic__patient--giggle");
          speak(round.patient.name + "!");
          return;
        }
        round.tapsLeft--;
        patientBtn.dataset.tapsLeft = String(round.tapsLeft);
        const pip = pileEl.lastElementChild;
        if (pip) pip.remove();
        const done = round.careTaps - round.tapsLeft;
        speak(String(done));
        blip(420 + done * 60, { duration: 0.14, gain: 0.18 });
        const spark = api.el("span", { class: "clinic__gag clinic__gag--care", text: round.careTool.careIcon, aria: { hidden: "true" } });
        patientBtn.appendChild(spark);
        setTimeout(() => spark.remove(), 900);
        if (round.tapsLeft <= 0) healCurrentAilment();
      }

      function healCurrentAilment() {
        patientBtn.removeAttribute("data-correct");
        patientBtn.removeAttribute("data-taps-left");
        const ail = round.ailments[round.ai];
        const ov = patientBtn.querySelector('[data-boo="' + ail + '"]');
        if (ov) ov.remove(); // the boo-boo dissolves — the transformation IS the reward
        patientBtn.classList.remove("clinic__patient--joy");
        void patientBtn.offsetWidth;
        patientBtn.classList.add("clinic__patient--joy");
        pileEl.textContent = "";
        if (round.ai < round.ailments.length - 1) {
          // Another silly boo-boo to fix (deep-session variety, same grammar).
          round.ai++;
          round.phase = "tool";
          speak("Look! " + round.patient.name + " also has " + (ailmentDef(round.ailments[round.ai]) || {}).say + "!");
          armRemedy();
        } else {
          round.phase = "sticker";
          toolTray.hidden = true;
          stickerTray.hidden = false;
          for (const b of stickerTray.querySelectorAll("button")) b.dataset.correct = "1";
          speak("All better! Pick a sticker for " + round.patient.name + "!");
        }
      }

      function onSticker(sticker) {
        if (!round || round.phase !== "sticker") return;
        round.phase = "exit";
        for (const b of stickerTray.querySelectorAll("button")) b.removeAttribute("data-correct");
        stickerTray.hidden = true;
        const chip = api.el("span", { class: "clinic__stick", text: sticker, aria: { hidden: "true" } });
        patientBtn.appendChild(chip);

        // Record the heal in the world save (the meadow is forever).
        const p = round.patient;
        const rec = { sp: p.sp, name: p.name, kind: p.kind, sticker, fed: {} };
        if (p.collar) rec.c = p.collar;
        if (p.color) rec.c = p.color;
        world.healed.push(rec);
        if (!world.egg) world.egg = { laidOnDay: JoshClinic.today() }; // hatches on a later day
        JoshClinic.save(world);
        if (meadowBuilt) buildMeadow(); // keep a visited meadow in sync

        api.roundWin({ say: p.name + " is all better!" });
        if (!wonThisSession) {
          wonThisSession = true;
          api.win({ say: "Doctor Josh, you did it!" });
          doorBtn.classList.add("clinic__door--pulse"); // psst — the meadow!
        }
        patientBtn.classList.add("clinic__patient--exit");
        setTimeout(() => { if (live()) nextPatient(); }, 1000);
      }

      // ---- the meadow (persistent, calm, endless) --------------------------
      function toggleRoom() {
        const toMeadow = !clinicRoom.hidden;
        if (toMeadow) {
          doorBtn.classList.remove("clinic__door--pulse");
          buildMeadow();
          meadowBuilt = true;
          tryHatch();
          clinicRoom.hidden = true;
          meadowRoom.hidden = false;
          doorBtn.textContent = "🚑";
          doorBtn.setAttribute("aria-label", "Back to the clinic");
          speak(world.healed.length ? "The meadow! All your friends live here!" : "The meadow is waiting. Heal a friend to fill it!");
        } else {
          meadowRoom.hidden = true;
          clinicRoom.hidden = false;
          doorBtn.textContent = "🌳";
          doorBtn.setAttribute("aria-label", "Go to the meadow");
          speak("Back to the clinic!");
        }
      }

      function residentFace(rec) {
        if (rec.kind === "pup" && ART.pup) return '<span class="clinic__face--mini">' + ART.pup(rec.c) + "</span>";
        if (rec.kind === "truck" && ART.truck) return '<span class="clinic__face--mini">' + ART.truck() + "</span>";
        if (rec.kind === "hero" && ART.hero) return '<span class="clinic__face--mini">' + ART.hero(rec.c) + "</span>";
        return '<span class="clinic__face--emoji">' + rec.sp + "</span>";
      }

      function buildMeadow() {
        meadowRoom.innerHTML = "";

        // Milestone props: the meadow itself grows as the roster grows.
        const props = api.el("div", { class: "clinic__props", aria: { hidden: "true" } });
        props.appendChild(api.el("span", { class: "clinic__prop", text: "🌞" }));
        if (world.healed.length >= 5) {
          props.appendChild(api.el("span", {
            class: "clinic__prop clinic__pond",
            html: '<svg viewBox="0 0 100 60"><ellipse cx="50" cy="34" rx="44" ry="20" fill="#7fd4f2" stroke="#5ab8dd" stroke-width="3"/><ellipse cx="38" cy="28" rx="10" ry="4" fill="rgba(255,255,255,0.6)"/></svg>',
          }));
        }
        if (world.healed.length >= 10) props.appendChild(api.el("span", { class: "clinic__prop", text: "🏠" }));
        if (world.healed.length >= 20) props.appendChild(api.el("span", { class: "clinic__prop", text: "🌈" }));
        meadowRoom.appendChild(props);

        // The nest: an egg appears after a heal and hatches on a LATER day —
        // the gentlest possible "come back tomorrow" (absence costs nothing).
        const nest = api.el("button", {
          class: "clinic__nest", type: "button",
          dataset: { toy: "1" },
          aria: { label: world.egg ? "egg" : "empty nest" },
          onclick: () => {
            api.tickPlay();
            nest.classList.remove("clinic__nest--wiggle");
            void nest.offsetWidth;
            nest.classList.add("clinic__nest--wiggle");
            speak(world.egg ? "Shh! The egg is sleeping. Come back tomorrow!" : "The nest is empty.");
          },
        });
        nest.innerHTML = world.egg && ART.egg ? ART.egg(false) : '<svg viewBox="0 0 100 100" aria-hidden="true"><ellipse cx="50" cy="66" rx="34" ry="18" fill="#c9a06a"/><ellipse cx="50" cy="60" rx="26" ry="11" fill="#8a6a42"/></svg>';
        meadowRoom.appendChild(nest);

        // Every friend Josh ever healed, wearing the exact sticker he chose.
        const field = api.el("div", { class: "clinic__field" });
        const residents = world.healed.map((rec) => ({ rec, hatchling: false }))
          .concat(world.hatched.map((rec) => ({ rec, hatchling: true })));
        for (const { rec, hatchling } of residents) {
          const b = api.el("button", {
            class: "clinic__resident", type: "button",
            dataset: { toy: "1" },
            aria: { label: rec.name },
          });
          b.innerHTML = hatchling ? '<span class="clinic__face--emoji">' + rec.sp + "</span>" : residentFace(rec);
          if (rec.sticker) b.appendChild(api.el("span", { class: "clinic__stick clinic__stick--worn", text: rec.sticker, aria: { hidden: "true" } }));
          b.addEventListener("click", () => {
            api.tickPlay();
            b.classList.remove("clinic__resident--hop");
            void b.offsetWidth;
            b.classList.add("clinic__resident--hop");
            if (treatSel) {
              const treat = CL.TREATS.find((t) => t.emoji === treatSel);
              const yum = api.el("span", { class: "clinic__yum", text: treatSel, aria: { hidden: "true" } });
              b.appendChild(yum);
              setTimeout(() => yum.remove(), 1200);
              if (!hatchling && rec.fed) { rec.fed[treatSel] = (rec.fed[treatSel] || 0) + 1; JoshClinic.save(world); }
              speak(treat ? treat.say : "Yum!");
              blip(500, { duration: 0.14, gain: 0.16 });
              setTimeout(() => blip(620, { duration: 0.14, gain: 0.14 }), 120);
            } else {
              speak(rec.name + "!");
              blip(560, { duration: 0.16, gain: 0.16 });
            }
          });
          field.appendChild(b);
        }
        if (!residents.length) {
          field.appendChild(api.el("div", { class: "clinic__empty", text: "🌼 🌱 🌼", aria: { hidden: "true" } }));
        }
        meadowRoom.appendChild(field);

        // The treat tray: select a treat, then tap any friend to feed them.
        if (residents.length) {
          const tray = api.el("div", { class: "choices choices--3 clinic__treats" });
          for (const treat of CL.TREATS) {
            const b = api.el("button", {
              class: "choice clinic__treat", type: "button",
              dataset: { toy: "1" },
              aria: { label: treat.name },
              onclick: () => {
                api.tickPlay();
                treatSel = treatSel === treat.emoji ? null : treat.emoji;
                for (const t of tray.querySelectorAll(".clinic__treat")) t.classList.toggle("clinic__treat--sel", t === b && treatSel);
                speak(treatSel ? treat.name + "! Who wants it?" : "");
              },
            }, [treat.emoji]);
            tray.appendChild(b);
          }
          meadowRoom.appendChild(tray);
        }
      }

      function tryHatch() {
        if (!world.egg || !L.eggHatches) return;
        if (!L.eggHatches(world.egg.laidOnDay, JoshClinic.today())) return;
        const pick = CL.HATCHLINGS[world.hatched.length % Math.max(1, CL.HATCHLINGS.length)] || { emoji: "🐤", name: "Chick" };
        world.egg = null;
        world.hatched.push({ sp: pick.emoji, name: pick.name });
        JoshClinic.save(world);
        buildMeadow(); // re-render with the new little friend
        const pop = api.el("div", { class: "clinic__hatch", aria: { hidden: "true" }, html: (ART.chick ? ART.chick() : "") });
        meadowRoom.appendChild(pop);
        setTimeout(() => pop.remove(), 1900);
        try { if (A.winCue) A.winCue(); } catch (e) { /* ignore */ }
        try { if (window.JoshEffects && window.JoshEffects.confetti) window.JoshEffects.confetti({ colors: C.CONFETTI_COLORS, count: 80 }); } catch (e) { /* ignore */ }
        speak("Ooh! The egg hatched! A " + pick.name + " joined the meadow!");
      }

      // Lights on — the first ambulance arrives.
      nextPatient();
    },
  });
})();
