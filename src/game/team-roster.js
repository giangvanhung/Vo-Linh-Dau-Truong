export class TeamRoster {
  constructor() {
    this.cpuIds = [];
    this.reset();
  }

  selectCpu(id) {
    this.cpuIds = [id, id];
  }

  reset() {
    this.activePlayer = this.activeCpu = 0;
  }

  callReserves(player, cpu, seconds, reservePlayerId, makeFighter) {
    const playerOut = player.hp <= 0, cpuOut = cpu.hp <= 0;
    if (seconds <= 0 || (playerOut && this.activePlayer) || (cpuOut && this.activeCpu)) return null;
    if (playerOut) this.activePlayer = 1;
    if (cpuOut) this.activeCpu = 1;
    return {
      player: playerOut ? makeFighter(reservePlayerId, 'hung') : player,
      cpu: cpuOut ? makeFighter(this.cpuIds[1], 'mai') : cpu,
      cpuOut,
      message: playerOut && cpuOut ? 'P2 VÀ CPU 2 VÀO SÂN' : playerOut ? 'P2 VÀO SÂN' : 'CPU 2 VÀO SÂN',
    };
  }

  lead(player, cpu, knockout) {
    if (knockout) {
      const playersLeft = Number(!this.activePlayer) + Number(player.hp > 0);
      const cpusLeft = Number(!this.activeCpu) + Number(cpu.hp > 0);
      return playersLeft - cpusLeft;
    }
    return player.hp / player.maxHp - cpu.hp / cpu.maxHp + this.activeCpu - this.activePlayer;
  }
}
