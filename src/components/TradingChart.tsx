import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  LineSeries,
  type IChartApi,
  type ISeriesApi,
  type Time,
} from "lightweight-charts";

export type Candle = { time: Time; open: number; high: number; low: number; close: number };

export function TradingChart({
  candles,
  showMA = true,
  showRSI = false,
}: {
  candles: Candle[];
  showMA?: boolean;
  showRSI?: boolean;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const candleSeriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const maSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);
  const rsiSeriesRef = useRef<ISeriesApi<"Line"> | null>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    const chart = createChart(containerRef.current, {
      layout: { background: { color: "transparent" }, textColor: "#94a3b8" },
      grid: {
        vertLines: { color: "rgba(148,163,184,0.08)" },
        horzLines: { color: "rgba(148,163,184,0.08)" },
      },
      rightPriceScale: { borderColor: "rgba(148,163,184,0.2)" },
      timeScale: { borderColor: "rgba(148,163,184,0.2)", timeVisible: true, secondsVisible: false },
      autoSize: true,
      crosshair: { mode: 1 },
    });
    chartRef.current = chart;
    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e",
      wickDownColor: "#ef4444",
    });
    candleSeriesRef.current = series;
    return () => {
      chart.remove();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!candleSeriesRef.current) return;
    candleSeriesRef.current.setData(candles as any);

    // MA(14)
    if (chartRef.current) {
      if (showMA) {
        if (!maSeriesRef.current) {
          maSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: "#3b82f6",
            lineWidth: 2,
            priceLineVisible: false,
          });
        }
        const ma: { time: Time; value: number }[] = [];
        const period = 14;
        for (let i = period - 1; i < candles.length; i++) {
          let sum = 0;
          for (let j = i - period + 1; j <= i; j++) sum += candles[j].close;
          ma.push({ time: candles[i].time, value: sum / period });
        }
        maSeriesRef.current.setData(ma);
      } else if (maSeriesRef.current) {
        chartRef.current.removeSeries(maSeriesRef.current);
        maSeriesRef.current = null;
      }

      // RSI(14) — separate scale
      if (showRSI) {
        if (!rsiSeriesRef.current) {
          rsiSeriesRef.current = chartRef.current.addSeries(LineSeries, {
            color: "#a855f7",
            lineWidth: 1,
            priceScaleId: "rsi",
            priceLineVisible: false,
          });
          chartRef.current
            .priceScale("rsi")
            .applyOptions({ scaleMargins: { top: 0.75, bottom: 0 } });
        }
        const period = 14;
        const rsi: { time: Time; value: number }[] = [];
        let gains = 0,
          losses = 0;
        for (let i = 1; i <= period && i < candles.length; i++) {
          const diff = candles[i].close - candles[i - 1].close;
          if (diff >= 0) gains += diff;
          else losses -= diff;
        }
        let avgGain = gains / period,
          avgLoss = losses / period;
        for (let i = period; i < candles.length; i++) {
          const diff = candles[i].close - candles[i - 1].close;
          const gain = diff > 0 ? diff : 0;
          const loss = diff < 0 ? -diff : 0;
          avgGain = (avgGain * (period - 1) + gain) / period;
          avgLoss = (avgLoss * (period - 1) + loss) / period;
          const rs = avgLoss === 0 ? 100 : avgGain / avgLoss;
          rsi.push({ time: candles[i].time, value: 100 - 100 / (1 + rs) });
        }
        rsiSeriesRef.current.setData(rsi);
      } else if (rsiSeriesRef.current) {
        chartRef.current.removeSeries(rsiSeriesRef.current);
        rsiSeriesRef.current = null;
      }
    }
  }, [candles, showMA, showRSI]);

  return <div ref={containerRef} className="h-[420px] w-full rounded-lg" />;
}
