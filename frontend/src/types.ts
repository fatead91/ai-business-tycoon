export type Point = [number, number];
export interface Department {
  id: string;
  name: string;
  code: string;
  color: string;
  x: number;
  y: number;
  width: number;
  height: number;
  description: string;
  job: string;
}
export interface Agent {
  id: string;
  name: string;
  role: string;
  department: string;
  color: string;
  position: Point;
  home: Point;
  station: Point;
  state: string;
  state_since: number;
  task_id: string | null;
  activity: string;
  route: { points: Point[]; started: number; duration: number } | null;
}
export interface Opportunity {
  event: string;
  market: string;
  back_exchange: string;
  lay_exchange: string;
  back_odds: number;
  lay_odds: number;
  back_commission: number;
  lay_commission: number;
  back_stake: number;
  lay_stake: number;
  liability: number;
  capital_required: number;
  estimated_profit: number;
  profit_if_win: number;
  profit_if_lose: number;
  roi: number;
  approved: boolean;
  reasons: string[];
  back_liquidity: number;
  lay_liquidity: number;
}
export interface Task {
  id: string;
  department: string;
  title: string;
  agent_ids: string[];
  stake: number;
  status: string;
  phase: string;
  progress: number;
  created: number;
  finished: number | null;
  error: string | null;
  history: { state: string; label: string; at: number }[];
  result: {
    kind: string;
    summary: string;
    opportunities?: Opportunity[];
    lines?: string[];
  } | null;
}
export interface Snapshot {
  departments: Department[];
  agents: Agent[];
  tasks: Task[];
  trades: (Opportunity & { task_id: string; id: number; created: number })[];
  events: {
    id: number;
    created: number;
    message: string;
    department: string;
    task_id: string | null;
  }[];
  treasury: {
    paper_capital: number;
    available: number;
    reserved: number;
    estimated_profit: number;
    real_revenue: number;
    real_expenses: number;
    realized_paper_profit: number;
  };
  server_time: number;
  mode: string;
  real_execution_enabled: boolean;
}
