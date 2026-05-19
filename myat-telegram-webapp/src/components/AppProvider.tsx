"use client";

import React, { createContext, useCallback, useContext, useEffect, useState } from "react";

type MeResponse = {
  [key: string]: any; 
  user: {
    telegramId: string;
    username?: string | null;
    firstName?: string | null;
    lastName?: string | null;
    photoUrl?: string | null;
    points: number;
    reservedPoints: number;
    availablePoints: number;
    referrerId?: string | null;
    referralCount: number;
    // Database schema ထဲမှာ Level တွေ သိမ်းထားရင် သုံးရန်
    tapLevel?: number;
    capLevel?: number;
    speedLevel?: number;
  };
  tasks: {
    periodKey: string;
    daily_login: boolean;
    phrase: boolean;
    follow_channel: boolean;
    join_group: boolean;
  };
  config: {
    rate: { ptsPerMMK: number };
    minWithdrawalPts: number;
    mainChannel: string;
    communityGroup: string;
  };
};

type Ctx = {
  me: MeResponse | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  completeTask: (taskKey: "daily_login" | "follow_channel" | "join_group") => Promise<void>;
  createOrder: (productKey: string) => Promise<void>;
  createWithdrawal: (points: number) => Promise<void>;
  addGamePoints: (pointsEarned: number) => Promise<void>;
};

const AppContext = createContext<Ctx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getRawTelegramInitData = useCallback(() => {
    if (typeof window === "undefined") return "";
    const tgWindow = window as any;
    let initData = tgWindow.Telegram?.WebApp?.initData || "";
    
    if (!initData && tgWindow.location?.hash) {
      const hashParams = new URLSearchParams(tgWindow.location.hash.substring(1));
      initData = hashParams.get("tgWebAppData") || "";
    }
    return initData;
  }, []);

  const refresh = useCallback(async () => {
    setError(null);
    const rawToken = getRawTelegramInitData();
    
    const res = await fetch("/api/me", { 
      cache: "no-store",
      headers: { 
        "Authorization": `Bearer ${rawToken}`,
        "Content-Type": "application/json"
      }
    });

    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setMe(null);
      setError(j?.error || "Cannot load profile");
      return;
    }
    const data = await res.json();
    setMe(data);
  }, [getRawTelegramInitData]);

  const loginIfNeeded = useCallback(async () => {
    const rawToken = getRawTelegramInitData();
    const authRes = await fetch("/api/auth/telegram", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ initData: rawToken }), 
    });

    if (!authRes.ok) {
      const j = await authRes.json().catch(() => ({}));
      setError(j?.error || "Authentication failed");
      return false;
    }

    return true;
  }, [getRawTelegramInitData]);

  useEffect(() => {
    let isMounted = true;
    (async () => {
      try {
        await new Promise((resolve) => setTimeout(resolve, 500));

        const tg = (window as any)?.Telegram?.WebApp;
        if (tg) {
          if (tg.ready) tg.ready();
          if (tg.expand) tg.expand();
        }
        
        const loginSuccess = await loginIfNeeded();
        if (loginSuccess && isMounted) {
          await refresh();
        }
      } catch (e: any) {
        if (isMounted) setError(e?.message || "Startup error");
      } finally {
        if (isMounted) setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [loginIfNeeded, refresh]);

  // ⚡ 🌟 BACKGROUND ENERGY REGENERATION ENGINE 
  // (ဘယ် Page ရောက်ရောက်၊ App ဖွင့်ထားသရွေ့ ၁ စက္ကန့်တစ်ခါ LocalStorage ထဲမှာ ⚡ အားသွင်းပေးမည့်နေရာ)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const interval = setInterval(() => {
      // LocalStorage ထဲက Level တွေကို ထောက်ပြီး လက်ရှိ Speed နှင့် Max Energy ကို တွက်ချက်မည်
      const savedCapLvl = localStorage.getItem("tw_lvl_cap") || "1";
      const savedSpeedLvl = localStorage.getItem("tw_lvl_speed") || "1";

      const maxEnergy = 500 + (Number(savedCapLvl) - 1) * 500;
      const energyRegenPerSec = 1 + (Number(savedSpeedLvl) - 1);

      const savedEnergy = localStorage.getItem("tw_energy") || "500";
      let currentEnergy = Number(savedEnergy);

      if (currentEnergy < maxEnergy) {
        currentEnergy += energyRegenPerSec;
        if (currentEnergy > maxEnergy) currentEnergy = maxEnergy;
        
        // အားတိုးသွားတာကို LocalStorage ထဲ သိမ်းမည်
        localStorage.setItem("tw_energy", String(currentEnergy));
      }
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const completeTask: Ctx["completeTask"] = useCallback(
    async (taskKey) => {
      setError(null);
      const rawToken = getRawTelegramInitData();
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${rawToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ taskKey }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Task failed");
      }
      await refresh();
    },
    [refresh, getRawTelegramInitData],
  );

  // 🕹️ [CONNECTED TO TASKS/COMPLETE] - Backend API
  const addGamePoints = useCallback(
    async (pointsEarned: number) => {
      setError(null);
      const rawToken = getRawTelegramInitData();
      
      setMe((prevMe) => {
        if (!prevMe) return null;
        return {
          ...prevMe,
          user: {
            ...prevMe.user,
            points: (prevMe.user?.points || 0) + pointsEarned,
          },
        };
      });

      try {
        const res = await fetch("/api/tasks/complete", {
          method: "POST",
          headers: { 
            "Authorization": `Bearer ${rawToken}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({ taskKey: "game_clicker", score: pointsEarned }),
        });

        const updatedData = await res.json();
        
        if (res.ok && updatedData && updatedData.user) {
          setMe((prev: any) => {
            if (!prev) return null;
            return { ...prev, user: updatedData.user };
          });
        } else {
          await refresh(); 
        }
      } catch (e) {
        console.error("Failed to sync game points to database:", e);
        await refresh();
      }
    },
    [refresh, getRawTelegramInitData]
  );

  const createOrder: Ctx["createOrder"] = useCallback(
    async (productKey) => {
      setError(null);
      const rawToken = getRawTelegramInitData();
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${rawToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ category: "WEBSITE", productKey }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Order failed");
      }
      await refresh();
    },
    [refresh, getRawTelegramInitData],
  );

  const createWithdrawal: Ctx["createWithdrawal"] = useCallback(
    async (points) => {
      setError(null);
      const rawToken = getRawTelegramInitData();
      const res = await fetch("/api/withdrawals", {
        method: "POST",
        headers: { 
          "Authorization": `Bearer ${rawToken}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify({ points }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j?.error || "Withdrawal failed");
      }
      await refresh();
    },
    [refresh, getRawTelegramInitData],
  );

  return (
    <AppContext.Provider value={{ me, loading, error, refresh, completeTask, createOrder, createWithdrawal, addGamePoints }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
  }
