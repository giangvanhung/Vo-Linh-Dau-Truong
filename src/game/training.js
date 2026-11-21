import { FRAME_SECONDS } from '../combat/fighter.js';
import { heroEnergyMax } from './hero-form.js';

const maxFrames = Math.round(10 / FRAME_SECONDS);

export class TrainingSession {
  constructor() {
    this.mode = 'stand';
    this.debug = false;
    this.recording = [];
    this.recordState = 'idle';
    this.playhead = 0;
    this.inputs = [];
    this.jumpClock = 0;
    this.clearStats();
  }

  clearStats() {
    this.hits = [];
    this.advantage = null;
  }

  resetActivity() {
    this.recordState = 'idle';
    this.jumpClock = 0;
    this.inputs.length = 0;
    this.clearStats();
  }

  noteInput(label) {
    this.inputs.push(label);
    if (this.inputs.length > 12) this.inputs.shift();
  }

  toggleRecord() {
    if (this.recordState === 'recording') {
      this.recordState = 'idle';
    } else if (this.recordState === 'idle') {
      this.recording = [];
      this.recordState = 'recording';
    }
  }

  togglePlayback() {
    if (this.recordState === 'playing') {
      this.recordState = 'idle';
    } else if (this.recordState === 'idle' && this.recording.length) {
      this.playhead = 0;
      this.recordState = 'playing';
    }
  }

  step(input) {
    if (this.recordState === 'recording') {
      this.recording.push(input);
      if (this.recording.length >= maxFrames) this.recordState = 'idle';
    } else if (this.recordState === 'playing') {
      const replay = this.recording[this.playhead++];
      if (this.playhead >= this.recording.length) this.recordState = 'idle';
      return replay;
    }
    return null;
  }

  trackHit(hit, player, target) {
    if (hit.attacker !== player) return;
    if (hit.blocked) {
      this.clearStats();
      return;
    }
    if (hit.combo <= 1) this.hits = [];
    this.hits.push(hit.damage);
    const attack = player.attack;
    const remaining = attack ? attack.startup + attack.active + attack.recovery - attack.elapsed : 0;
    this.advantage = Math.max(target.hitstun, target.knockdown)
      - Math.max(remaining, Math.ceil(player.attackLock / FRAME_SECONDS), player.hitstun, player.knockdown);
  }

  controlDummy(dummy, dt, jumpVelocity) {
    const guarding = this.mode === 'block' || this.mode === 'low';
    dummy.lowGuardOnly = this.mode === 'low';
    if (guarding && dummy.onGround && !dummy.disabled) {
      dummy.guard = dummy.rules.guardMax;
      dummy.guardReleaseRequired = false;
    }
    dummy.setGuard(guarding);
    dummy.crouching = dummy.blocking && dummy.lowGuardOnly;
    if (this.mode === 'jump') {
      this.jumpClock -= dt;
      if (this.jumpClock <= 0 && dummy.onGround && !dummy.disabled && !dummy.attacking && !dummy.dash) {
        dummy.vy = -jumpVelocity;
        dummy.onGround = false;
        this.jumpClock = 1.4;
      }
    } else {
      this.jumpClock = 0;
    }
  }
}

export function createTrainingActions(training, { canUse, fighters, resetFighters, updateScore, focusArena }) {
  return {
    canUse,
    resetPosition() {
      if (!canUse()) return;
      const vitals = fighters().map(({ hp, meter }) => ({ hp, meter }));
      training.resetActivity();
      resetFighters();
      fighters().forEach((fighter, index) => {
        fighter.hp = Math.min(fighter.maxHp, vitals[index].hp);
        fighter.meter = vitals[index].meter;
      });
      updateScore();
    },
    resetHealth() {
      if (!canUse()) return;
      for (const fighter of fighters()) fighter.hp = fighter.maxHp;
      updateScore();
    },
    testAwakening() {
      if (!canUse()) return;
      const [player] = fighters();
      if (player.heroForm) {
        player.heroEnergy = heroEnergyMax;
        focusArena();
        return;
      }
      player.gainMeter(player.meterMax);
      player.awakeningUnlocked = true;
      if (!player.nextAwakening) player.endAwakening();
      updateScore();
      focusArena();
    },
    resetMeter() {
      if (!canUse()) return;
      for (const fighter of fighters()) {
        fighter.meter = 0;
        fighter.heroEnergy = 0;
      }
    },
  };
}
