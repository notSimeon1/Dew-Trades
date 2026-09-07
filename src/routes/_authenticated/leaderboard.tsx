import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { VipBadge, getVipTier } from "@/components/VipBadge";
import { soundFX } from "@/lib/sound-engine";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Trophy,
  Crown,
  Medal,
  Flame,
  Zap,
  TrendingUp,
  Award,
  Clock,
  Search,
  ArrowUpRight,
  ShieldCheck,
  Gift,
  Coins,
} from "lucide-react";
import { motion } from "framer-motion";

export const Route = createFileRoute("/_authenticated/leaderboard")({
  component: LeaderboardPage,
  head: () => ({ meta: [{ title: "Trader Leaderboard & Monthly Tournament — Dew Trades" }] }),
});

interface LeaderboardUser {
  id: string;
  name: string;
  email: string;
  country: string;
  totalDeposit: number;
  winRate: number;
  tradesCount: number;
  tournamentPoints: number;
  rank: number;
}

const FAKE_COMPETITORS: Omit<LeaderboardUser, "rank">[] = [
  {
    id: "comp-1",
    name: "Alex Vance 🐋",
    email: "alex.vance@protrader.io",
    country: "United States",
    totalDeposit: 48500,
    winRate: 94.2,
    tradesCount: 184,
    tournamentPoints: 145500,
  },
  {
    id: "comp-2",
    name: "Satoshi_N 👑",
    email: "satoshi@block.org",
    country: "Japan",
    totalDeposit: 39200,
    winRate: 91.8,
    tradesCount: 142,
    tournamentPoints: 117600,
  },
  {
    id: "comp-3",
    name: "Sofia Rossi",
    email: "sofia.r@milan.it",
    country: "Italy",
    totalDeposit: 31000,
    winRate: 89.5,
    tradesCount: 128,
    tournamentPoints: 93000,
  },
  {
    id: "comp-4",
    name: "Kenji Takahashi ⚡",
    email: "kenji@tokyo-quant.jp",
    country: "Japan",
    totalDeposit: 24500,
    winRate: 87.4,
    tradesCount: 96,
    tournamentPoints: 73500,
  },
  {
    id: "comp-5",
    name: "Chen Wei",
    email: "chen.w@singapore.sg",
    country: "Singapore",
    totalDeposit: 19800,
    winRate: 86.1,
    tradesCount: 115,
    tournamentPoints: 59400,
  },
  {
    id: "comp-6",
    name: "Elena Rostova",
    email: "elena@zurich-fund.ch",
    country: "Switzerland",
    totalDeposit: 16200,
    winRate: 84.8,
    tradesCount: 88,
    tournamentPoints: 48600,
  },
  {
    id: "comp-7",
    name: "Marcus Sterling",
    email: "marcus@london-cap.uk",
    country: "United Kingdom",
    totalDeposit: 12900,
    winRate: 83.2,
    tradesCount: 74,
    tournamentPoints: 38700,
  },
  {
    id: "comp-8",
    name: "Diego Silva",
    email: "diego@rio.br",
    country: "Brazil",
    totalDeposit: 9800,
    winRate: 81.7,
    tradesCount: 62,
    tournamentPoints: 29400,
  },
  {
    id: "comp-9",
    name: "Tariq Al-Mansoor",
    email: "tariq@dubai.ae",
    country: "United Arab Emirates",
    totalDeposit: 8400,
    winRate: 80.5,
    tradesCount: 53,
    tournamentPoints: 25200,
  },
  {
    id: "comp-10",
    name: "Liam O'Connor",
    email: "liam@sydney.au",
    country: "Australia",
    totalDeposit: 6700,
    winRate: 79.1,
    tradesCount: 49,
    tournamentPoints: 20100,
  },
  {
    id: "comp-11",
    name: "Chloe Dubois",
    email: "chloe@paris.fr",
    country: "France",
    totalDeposit: 5200,
    winRate: 78.4,
    tradesCount: 41,
    tournamentPoints: 15600,
  },
  {
    id: "comp-12",
    name: "Hans Mueller",
    email: "hans@frankfurt.de",
    country: "Germany",
    totalDeposit: 4100,
    winRate: 76.9,
    tradesCount: 38,
    tournamentPoints: 12300,
  },
  {
    id: "comp-13",
    name: "Aisha Okafor",
    email: "aisha@lagos.ng",
    country: "Nigeria",
    totalDeposit: 3300,
    winRate: 75.2,
    tradesCount: 31,
    tournamentPoints: 9900,
  },
  {
    id: "comp-14",
    name: "Lucas Vance",
    email: "lucas@toronto.ca",
    country: "Canada",
    totalDeposit: 2500,
    winRate: 74.0,
    tradesCount: 27,
    tournamentPoints: 7500,
  },
  {
    id: "comp-15",
    name: "Kwon Ji-hoon",
    email: "kwon@seoul.kr",
    country: "South Korea",
    totalDeposit: 1800,
    winRate: 72.8,
    tradesCount: 22,
    tournamentPoints: 5400,
  },
];

function LeaderboardPage() {
  const { user } = useAuth();
  const [search, setSearch] = useState("");

  // Countdown timer for tournament month
  const [timeLeft, setTimeLeft] = useState({ days: 14, hours: 8, minutes: 22, seconds: 45 });

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev.seconds > 0) return { ...prev, seconds: prev.seconds - 1 };
        if (prev.minutes > 0) return { ...prev, minutes: 59, seconds: 59 };
        if (prev.hours > 0) return { ...prev, hours: prev.hours - 1, minutes: 59, seconds: 59 };
        if (prev.days > 0) return { days: prev.days - 1, hours: 23, minutes: 59, seconds: 59 };
        return { days: 30, hours: 0, minutes: 0, seconds: 0 };
      });
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Fetch real profiles & deposits from DB
  const { data: profiles } = useQuery({
    queryKey: ["leaderboard_profiles"],
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name, email, live_balance, country");
      return data ?? [];
    },
  });

  const { data: allDeposits } = useQuery({
    queryKey: ["leaderboard_deposits"],
    queryFn: async () => {
      const { data } = await supabase
        .from("deposits")
        .select("user_id, amount_usd, status")
        .eq("status", "approved");
      return data ?? [];
    },
  });

  // Build combined leaderboard rankings with pure competitive fake data & real user data
  const rankings: LeaderboardUser[] = useMemo(() => {
    // Map total deposits per user
    const depositMap: Record<string, number> = {};
    (allDeposits ?? []).forEach((d: any) => {
      if (d.user_id) {
        depositMap[d.user_id] = (depositMap[d.user_id] || 0) + (Number(d.amount_usd) || 0);
      }
    });

    const realUserList: LeaderboardUser[] = (profiles ?? []).map((p: any, idx: number) => {
      const realDep = depositMap[p.id] || Number(p.live_balance ?? 0) || 0;
      const tier = getVipTier(realDep);
      const mult = tier === "Whale" ? 3.0 : tier === "Gold" ? 2.0 : tier === "Silver" ? 1.5 : 1.0;
      const points = Math.round(realDep * mult + (realDep > 0 ? 500 : 50));

      const rawName =
        p.full_name || (p.email ? p.email.split("@")[0] : `Trader_${p.id.slice(0, 5)}`);

      return {
        id: p.id,
        name: rawName,
        email: p.email || "",
        country: p.country || "Australia",
        totalDeposit: realDep,
        winRate: Math.min(96, Math.max(68, 82 + (idx % 7))),
        tradesCount: 8 + idx * 3,
        tournamentPoints: points,
        rank: 0,
      };
    });

    // Combine fake competitors and real users
    const combinedMap = new Map<string, LeaderboardUser>();

    // Add fake competitors
    FAKE_COMPETITORS.forEach((fc) => {
      combinedMap.set(fc.id, { ...fc, rank: 0 });
    });

    // Add/overwrite with real user profiles
    realUserList.forEach((ru) => {
      combinedMap.set(ru.id, ru);
    });

    const userList = Array.from(combinedMap.values());

    // Sort descending by tournament points
    userList.sort((a, b) => b.tournamentPoints - a.tournamentPoints);
    userList.forEach((u, i) => {
      u.rank = i + 1;
    });

    return userList;
  }, [profiles, allDeposits]);

  const filteredRankings = useMemo(() => {
    if (!search.trim()) return rankings;
    const q = search.toLowerCase();
    return rankings.filter(
      (u) => u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q),
    );
  }, [rankings, search]);

  const top3 = rankings.slice(0, 3);
  const myRanking = rankings.find((u) => u.id === user?.id);

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6 text-slate-100">
      {/* Header & Tournament Banner */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-amber-950 via-slate-900 to-purple-950 border border-amber-500/30 p-6 sm:p-8 shadow-2xl">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 h-64 w-64 rounded-full bg-amber-500/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2 max-w-xl">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/20 px-3 py-1 text-xs font-black text-amber-300 border border-amber-500/40 uppercase tracking-wider">
              <Trophy className="h-3.5 w-3.5 text-amber-400 animate-bounce" /> $50,000 MONTHLY
              DEPOSIT & TRADING CHAMPIONSHIP
            </span>

            <h1 className="text-3xl sm:text-4xl font-black text-white tracking-tight">
              Trader Leaderboard &{" "}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-300 via-yellow-200 to-amber-500">
                Tournament
              </span>
            </h1>

            <p className="text-sm text-slate-300">
              Rankings are updated live based on total deposits and trading performance. Higher
              deposit tiers unlock up to{" "}
              <strong className="text-amber-300">3x Tournament Multiplier Points!</strong>
            </p>
          </div>

          {/* Tournament Timer & Prize Card */}
          <div className="bg-slate-950/90 border border-amber-500/30 rounded-2xl p-4 sm:p-5 space-y-3 shrink-0 text-center shadow-xl">
            <div className="text-xs uppercase font-extrabold text-amber-400 tracking-wider flex items-center justify-center gap-1.5">
              <Clock className="h-4 w-4" /> Season Closes In
            </div>

            <div className="flex items-center justify-center gap-2 font-mono text-xl font-black text-white">
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                {String(timeLeft.days).padStart(2, "0")}
                <span className="text-[10px] block font-sans text-slate-400">DAYS</span>
              </div>
              <span>:</span>
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                {String(timeLeft.hours).padStart(2, "0")}
                <span className="text-[10px] block font-sans text-slate-400">HRS</span>
              </div>
              <span>:</span>
              <div className="bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1">
                {String(timeLeft.minutes).padStart(2, "0")}
                <span className="text-[10px] block font-sans text-slate-400">MIN</span>
              </div>
            </div>

            <Link
              to="/deposit"
              onClick={() => soundFX.playClick()}
              className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-amber-500 to-yellow-600 px-4 py-2.5 text-xs font-black text-slate-950 shadow-lg hover:from-amber-400 hover:to-yellow-500 transition-all hover:scale-[1.02]"
            >
              <Flame className="h-4 w-4 fill-black" /> DEPOSIT TO CLIMB RANK
            </Link>
          </div>
        </div>
      </div>

      {/* PODIUM SHOWCASE (Top 3) */}
      <div className="grid gap-4 sm:grid-cols-3">
        {/* Silver #2 */}
        {top3[1] && (
          <Card className="p-5 bg-gradient-to-b from-slate-900 to-slate-950 border-slate-400/30 rounded-2xl text-center space-y-3 order-2 sm:order-1 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-2xl font-black text-slate-400 opacity-30">
              #2
            </div>
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-slate-300 to-slate-500 p-1 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-extrabold text-slate-950">🥈</span>
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base truncate">{top3[1].name}</h3>
              <p className="text-xs text-slate-400">{top3[1].country}</p>
            </div>
            <VipBadge amount={top3[1].totalDeposit} size="sm" />
            <div className="pt-2 border-t border-slate-800 flex justify-around text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400">DEPOSITED</div>
                <div className="font-bold text-emerald-400">
                  ${top3[1].totalDeposit.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">POINTS</div>
                <div className="font-bold text-purple-300">
                  {top3[1].tournamentPoints.toLocaleString()}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Gold #1 Champion */}
        {top3[0] && (
          <Card className="p-6 bg-gradient-to-b from-amber-950/60 via-slate-900 to-slate-950 border-amber-500/50 rounded-2xl text-center space-y-3 order-1 sm:order-2 shadow-2xl relative overflow-hidden scale-105 z-10">
            <div className="absolute top-2 right-2 text-3xl font-black text-amber-400 opacity-40">
              #1
            </div>
            <div className="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-amber-400 via-yellow-300 to-amber-600 p-1 flex items-center justify-center shadow-amber-500/40 shadow-xl animate-pulse">
              <span className="text-3xl font-extrabold text-slate-950">👑</span>
            </div>
            <div>
              <span className="rounded-full bg-amber-500/20 px-2.5 py-0.5 text-[10px] font-black text-amber-300 border border-amber-500/40">
                CURRENT LEADER
              </span>
              <h3 className="font-black text-white text-lg mt-1 truncate">{top3[0].name}</h3>
              <p className="text-xs text-amber-200/80">{top3[0].country}</p>
            </div>
            <VipBadge amount={top3[0].totalDeposit} size="md" />
            <div className="pt-3 border-t border-amber-500/30 flex justify-around text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400">DEPOSITED</div>
                <div className="font-black text-emerald-300 text-sm">
                  ${top3[0].totalDeposit.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">WIN RATE</div>
                <div className="font-black text-amber-300 text-sm">{top3[0].winRate}%</div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">POINTS</div>
                <div className="font-black text-purple-300 text-sm">
                  {top3[0].tournamentPoints.toLocaleString()}
                </div>
              </div>
            </div>
          </Card>
        )}

        {/* Bronze #3 */}
        {top3[2] && (
          <Card className="p-5 bg-gradient-to-b from-slate-900 to-slate-950 border-amber-800/30 rounded-2xl text-center space-y-3 order-3 relative overflow-hidden">
            <div className="absolute top-2 right-2 text-2xl font-black text-amber-700 opacity-30">
              #3
            </div>
            <div className="mx-auto h-16 w-16 rounded-full bg-gradient-to-br from-amber-700 to-amber-900 p-1 flex items-center justify-center shadow-lg">
              <span className="text-2xl font-extrabold text-amber-100">🥉</span>
            </div>
            <div>
              <h3 className="font-extrabold text-white text-base truncate">{top3[2].name}</h3>
              <p className="text-xs text-slate-400">{top3[2].country}</p>
            </div>
            <VipBadge amount={top3[2].totalDeposit} size="sm" />
            <div className="pt-2 border-t border-slate-800 flex justify-around text-xs font-mono">
              <div>
                <div className="text-[10px] text-slate-400">DEPOSITED</div>
                <div className="font-bold text-emerald-400">
                  ${top3[2].totalDeposit.toLocaleString()}
                </div>
              </div>
              <div>
                <div className="text-[10px] text-slate-400">POINTS</div>
                <div className="font-bold text-purple-300">
                  {top3[2].tournamentPoints.toLocaleString()}
                </div>
              </div>
            </div>
          </Card>
        )}
      </div>

      {/* USER PERSONAL RANK SUMMARY CARD */}
      {myRanking && (
        <Card className="p-4 bg-emerald-950/40 border-emerald-500/40 rounded-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-emerald-500/20 text-emerald-300 font-mono font-black text-lg border border-emerald-500/30">
              #{myRanking.rank}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-white text-sm">Your Tournament Status:</span>
                <VipBadge amount={myRanking.totalDeposit} size="sm" />
              </div>
              <p className="text-xs text-slate-300 mt-0.5">
                Total Deposited:{" "}
                <strong className="text-emerald-400 font-mono">
                  ${myRanking.totalDeposit.toLocaleString()}
                </strong>{" "}
                | Points:{" "}
                <strong className="text-purple-300 font-mono">
                  {myRanking.tournamentPoints.toLocaleString()}
                </strong>
              </p>
            </div>
          </div>

          <Link
            to="/deposit"
            className="rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-extrabold text-xs px-4 py-2.5 transition-all shadow-md shrink-0"
          >
            Deposit More to Boost Rank (+2x Points) →
          </Link>
        </Card>
      )}

      {/* FULL RANKINGS TABLE */}
      <Card className="p-0 bg-slate-900/90 border-slate-800 rounded-2xl overflow-hidden shadow-2xl">
        <div className="p-4 border-b border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h3 className="font-bold text-white text-sm">Full Tournament Standings</h3>
            <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-mono text-slate-400">
              {rankings.length} Registered Competitors
            </span>
          </div>

          <div className="relative w-full sm:w-64">
            <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search trader by name or country..."
              className="pl-9 h-8 text-xs bg-slate-950 border-slate-800 text-slate-100 placeholder-slate-500 rounded-xl"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs font-sans">
            <thead className="bg-slate-950/80 text-slate-400 text-[10px] uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="px-4 py-3">Rank</th>
                <th className="px-4 py-3">Trader</th>
                <th className="px-4 py-3">VIP Tier</th>
                <th className="px-4 py-3 text-right">Deposited (USD)</th>
                <th className="px-4 py-3 text-right">Win Rate</th>
                <th className="px-4 py-3 text-right">Tournament Points</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 font-mono">
              {filteredRankings.map((u) => {
                const isMe = u.id === user?.id;
                return (
                  <tr
                    key={u.id}
                    className={`transition-colors hover:bg-slate-800/40 ${
                      isMe ? "bg-emerald-950/30 border-l-4 border-emerald-500" : ""
                    }`}
                  >
                    <td className="px-4 py-3 font-bold text-slate-300">
                      {u.rank === 1 ? (
                        <span className="text-amber-400">🥇 #1</span>
                      ) : u.rank === 2 ? (
                        <span className="text-slate-300">🥈 #2</span>
                      ) : u.rank === 3 ? (
                        <span className="text-amber-600">🥉 #3</span>
                      ) : (
                        `#${u.rank}`
                      )}
                    </td>

                    <td className="px-4 py-3 font-sans font-semibold text-white">
                      <div className="flex items-center gap-2">
                        <span>{u.name}</span>
                        {isMe && (
                          <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] text-emerald-400 font-bold border border-emerald-500/30">
                            YOU
                          </span>
                        )}
                      </div>
                      <div className="text-[10px] text-slate-400 font-normal">{u.country}</div>
                    </td>

                    <td className="px-4 py-3">
                      <VipBadge amount={u.totalDeposit} size="sm" />
                    </td>

                    <td className="px-4 py-3 text-right font-bold text-emerald-400">
                      ${u.totalDeposit.toLocaleString()}
                    </td>

                    <td className="px-4 py-3 text-right text-slate-300 font-bold">{u.winRate}%</td>

                    <td className="px-4 py-3 text-right font-black text-purple-300">
                      {u.tournamentPoints.toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
