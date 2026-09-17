export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      admin_balance_logs: {
        Row: {
          action: string;
          admin_id: string;
          amount: number;
          asset_symbol: string | null;
          balance_type: string;
          created_at: string;
          fiat_value_usd: number | null;
          id: string;
          reason: string | null;
          target_user_id: string;
        };
        Insert: {
          action: string;
          admin_id: string;
          amount: number;
          asset_symbol?: string | null;
          balance_type: string;
          created_at?: string;
          fiat_value_usd?: number | null;
          id?: string;
          reason?: string | null;
          target_user_id: string;
        };
        Update: {
          action?: string;
          admin_id?: string;
          amount?: number;
          asset_symbol?: string | null;
          balance_type?: string;
          created_at?: string;
          fiat_value_usd?: number | null;
          id?: string;
          reason?: string | null;
          target_user_id?: string;
        };
        Relationships: [];
      };
      admin_payment_methods: {
        Row: {
          created_at: string;
          extra: Json;
          id: string;
          identifier: string;
          identifier_label: string;
          is_active: boolean;
          method_key: string;
          method_name: string;
          recipient_name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          extra?: Json;
          id?: string;
          identifier?: string;
          identifier_label: string;
          is_active?: boolean;
          method_key: string;
          method_name: string;
          recipient_name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          extra?: Json;
          id?: string;
          identifier?: string;
          identifier_label?: string;
          is_active?: boolean;
          method_key?: string;
          method_name?: string;
          recipient_name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      app_settings: {
        Row: {
          key: string;
          updated_at: string;
          value: string;
        };
        Insert: {
          key: string;
          updated_at?: string;
          value: string;
        };
        Update: {
          key?: string;
          updated_at?: string;
          value?: string;
        };
        Relationships: [];
      };
      assets: {
        Row: {
          asset_class: string;
          created_at: string;
          current_price: number;
          daily_change_percent: number;
          id: string;
          name: string;
          ticker: string;
        };
        Insert: {
          asset_class: string;
          created_at?: string;
          current_price: number;
          daily_change_percent?: number;
          id?: string;
          name: string;
          ticker: string;
        };
        Update: {
          asset_class?: string;
          created_at?: string;
          current_price?: number;
          daily_change_percent?: number;
          id?: string;
          name?: string;
          ticker?: string;
        };
        Relationships: [];
      };
      bank_deposit_methods: {
        Row: {
          account_name: string;
          account_number: string | null;
          bank_address: string | null;
          created_at: string;
          id: string;
          is_active: boolean;
          max_amount: number;
          method_name: string;
          method_type: string;
          min_amount: number;
          notes: string | null;
          routing_number: string | null;
          swift_code: string | null;
          updated_at: string;
        };
        Insert: {
          account_name: string;
          account_number?: string | null;
          bank_address?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          max_amount?: number;
          method_name: string;
          method_type: string;
          min_amount?: number;
          notes?: string | null;
          routing_number?: string | null;
          swift_code?: string | null;
          updated_at?: string;
        };
        Update: {
          account_name?: string;
          account_number?: string | null;
          bank_address?: string | null;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          max_amount?: number;
          method_name?: string;
          method_type?: string;
          min_amount?: number;
          notes?: string | null;
          routing_number?: string | null;
          swift_code?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      buy_crypto_orders: {
        Row: {
          asset_symbol: string;
          base_amount: number;
          created_at: string;
          crypto_amount: number;
          expires_at: string;
          gas_fee_amount: number;
          id: string;
          payment_method_key: string;
          receipt_url: string | null;
          reviewed_at: string | null;
          status: string;
          total_payable: number;
          user_id: string;
        };
        Insert: {
          asset_symbol: string;
          base_amount: number;
          created_at?: string;
          crypto_amount: number;
          expires_at?: string;
          gas_fee_amount?: number;
          id?: string;
          payment_method_key: string;
          receipt_url?: string | null;
          reviewed_at?: string | null;
          status?: string;
          total_payable: number;
          user_id: string;
        };
        Update: {
          asset_symbol?: string;
          base_amount?: number;
          created_at?: string;
          crypto_amount?: number;
          expires_at?: string;
          gas_fee_amount?: number;
          id?: string;
          payment_method_key?: string;
          receipt_url?: string | null;
          reviewed_at?: string | null;
          status?: string;
          total_payable?: number;
          user_id?: string;
        };
        Relationships: [];
      };
      complaints: {
        Row: {
          created_at: string;
          email: string;
          id: string;
          message: string;
          name: string;
          status: string;
          subject: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          email: string;
          id?: string;
          message: string;
          name: string;
          status?: string;
          subject: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          email?: string;
          id?: string;
          message?: string;
          name?: string;
          status?: string;
          subject?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      copy_trading_tiers: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          lock_in_days: number;
          monthly_roi_max: number;
          monthly_roi_min: number;
          perks: Json;
          profit_share: number;
          required_capital: number;
          risk_rating: string;
          sort_order: number;
          strategist_name: string;
          tier_key: string;
          tier_name: string;
          updated_at: string;
          win_rate: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lock_in_days?: number;
          monthly_roi_max: number;
          monthly_roi_min: number;
          perks?: Json;
          profit_share?: number;
          required_capital: number;
          risk_rating?: string;
          sort_order?: number;
          strategist_name: string;
          tier_key: string;
          tier_name: string;
          updated_at?: string;
          win_rate: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          lock_in_days?: number;
          monthly_roi_max?: number;
          monthly_roi_min?: number;
          perks?: Json;
          profit_share?: number;
          required_capital?: number;
          risk_rating?: string;
          sort_order?: number;
          strategist_name?: string;
          tier_key?: string;
          tier_name?: string;
          updated_at?: string;
          win_rate?: number;
        };
        Relationships: [];
      };
      deposits: {
        Row: {
          admin_note: string | null;
          amount: number;
          bank_method_id: string | null;
          base_amount: number | null;
          created_at: string;
          crypto_currency: string;
          expires_at: string | null;
          fiat_currency: string | null;
          gas_fee_amount: number | null;
          id: string;
          payment_method: string;
          payment_method_key: string | null;
          receipt_url: string | null;
          reviewed_at: string | null;
          status: string;
          total_payable: number | null;
          tx_hash: string | null;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          amount: number;
          bank_method_id?: string | null;
          base_amount?: number | null;
          created_at?: string;
          crypto_currency?: string;
          expires_at?: string | null;
          fiat_currency?: string | null;
          gas_fee_amount?: number | null;
          id?: string;
          payment_method?: string;
          payment_method_key?: string | null;
          receipt_url?: string | null;
          reviewed_at?: string | null;
          status?: string;
          total_payable?: number | null;
          tx_hash?: string | null;
          user_id: string;
        };
        Update: {
          admin_note?: string | null;
          amount?: number;
          bank_method_id?: string | null;
          base_amount?: number | null;
          created_at?: string;
          crypto_currency?: string;
          expires_at?: string | null;
          fiat_currency?: string | null;
          gas_fee_amount?: number | null;
          id?: string;
          payment_method?: string;
          payment_method_key?: string | null;
          receipt_url?: string | null;
          reviewed_at?: string | null;
          status?: string;
          total_payable?: number | null;
          tx_hash?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "deposits_bank_method_id_fkey";
            columns: ["bank_method_id"];
            isOneToOne: false;
            referencedRelation: "bank_deposit_methods";
            referencedColumns: ["id"];
          },
        ];
      };
      kyc_submissions: {
        Row: {
          admin_note: string | null;
          country: string | null;
          created_at: string;
          date_of_birth: string | null;
          document_type: string;
          document_url: string;
          full_name: string;
          id: string;
          reviewed_at: string | null;
          status: string;
          user_id: string;
        };
        Insert: {
          admin_note?: string | null;
          country?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          document_type: string;
          document_url: string;
          full_name: string;
          id?: string;
          reviewed_at?: string | null;
          status?: string;
          user_id: string;
        };
        Update: {
          admin_note?: string | null;
          country?: string | null;
          created_at?: string;
          date_of_birth?: string | null;
          document_type?: string;
          document_url?: string;
          full_name?: string;
          id?: string;
          reviewed_at?: string | null;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      live_positions: {
        Row: {
          account_mode: string;
          asset: string;
          close_price: number | null;
          closed_at: string | null;
          entry_price: number;
          id: string;
          leverage: number;
          margin: number;
          opened_at: string;
          pnl: number;
          quantity: number;
          side: string;
          status: string;
          user_id: string;
        };
        Insert: {
          account_mode?: string;
          asset: string;
          close_price?: number | null;
          closed_at?: string | null;
          entry_price: number;
          id?: string;
          leverage?: number;
          margin: number;
          opened_at?: string;
          pnl?: number;
          quantity: number;
          side: string;
          status?: string;
          user_id: string;
        };
        Update: {
          account_mode?: string;
          asset?: string;
          close_price?: number | null;
          closed_at?: string | null;
          entry_price?: number;
          id?: string;
          leverage?: number;
          margin?: number;
          opened_at?: string;
          pnl?: number;
          quantity?: number;
          side?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      market_news: {
        Row: {
          body: string | null;
          created_at: string;
          id: string;
          impact: string;
          source: string | null;
          title: string;
        };
        Insert: {
          body?: string | null;
          created_at?: string;
          id?: string;
          impact?: string;
          source?: string | null;
          title: string;
        };
        Update: {
          body?: string | null;
          created_at?: string;
          id?: string;
          impact?: string;
          source?: string | null;
          title?: string;
        };
        Relationships: [];
      };
      notifications: {
        Row: {
          created_at: string;
          id: string;
          is_read: boolean;
          message: string;
          title: string;
          type: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message: string;
          title: string;
          type?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message?: string;
          title?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      p2p_messages: {
        Row: {
          connection_id: string;
          created_at: string;
          id: string;
          is_read: boolean;
          message_text: string;
          sender_id: string;
        };
        Insert: {
          connection_id: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message_text: string;
          sender_id: string;
        };
        Update: {
          connection_id?: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          message_text?: string;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "p2p_messages_connection_id_fkey";
            columns: ["connection_id"];
            isOneToOne: false;
            referencedRelation: "referral_connections";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_announcements: {
        Row: {
          category: string;
          content: string;
          created_at: string;
          id: string;
          is_urgent: boolean;
          title: string;
          updated_at: string;
        };
        Insert: {
          category?: string;
          content: string;
          created_at?: string;
          id?: string;
          is_urgent?: boolean;
          title: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          content?: string;
          created_at?: string;
          id?: string;
          is_urgent?: boolean;
          title?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      platform_settings: {
        Row: {
          category: string;
          description: string | null;
          id: string;
          key_name: string;
          updated_at: string;
          value: Json;
        };
        Insert: {
          category: string;
          description?: string | null;
          id?: string;
          key_name: string;
          updated_at?: string;
          value: Json;
        };
        Update: {
          category?: string;
          description?: string | null;
          id?: string;
          key_name?: string;
          updated_at?: string;
          value?: Json;
        };
        Relationships: [];
      };
      pre_market_tokens: {
        Row: {
          created_at: string;
          id: string;
          is_active: boolean;
          listing_price: number;
          min_allocation: number;
          perks: Json;
          pool_cap: number;
          sort_order: number;
          symbol: string;
          tge_date: string;
          token_name: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          listing_price: number;
          min_allocation?: number;
          perks?: Json;
          pool_cap: number;
          sort_order?: number;
          symbol: string;
          tge_date: string;
          token_name: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          is_active?: boolean;
          listing_price?: number;
          min_allocation?: number;
          perks?: Json;
          pool_cap?: number;
          sort_order?: number;
          symbol?: string;
          tge_date?: string;
          token_name?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          account_balance: number;
          account_mode: string;
          ai_trading_enabled: boolean;
          available_cash: number;
          avatar_url: string | null;
          chart_intensity: number;
          chart_mode: string;
          chart_seed: number;
          created_at: string;
          crypto_balances: Json | null;
          demo_balance: number;
          full_name: string | null;
          id: string;
          is_suspended: boolean;
          kyc_status: string;
          live_balance: number;
          preferred_currency: string | null;
          referral_code: string | null;
          referred_by: string | null;
          signals_lifetime: boolean | null;
          signals_trial_expires_at: string | null;
          signals_trial_started_at: string | null;
          updated_at: string;
        };
        Insert: {
          account_balance?: number;
          account_mode?: string;
          ai_trading_enabled?: boolean;
          available_cash?: number;
          avatar_url?: string | null;
          chart_intensity?: number;
          chart_mode?: string;
          chart_seed?: number;
          created_at?: string;
          crypto_balances?: Json | null;
          demo_balance?: number;
          full_name?: string | null;
          id: string;
          is_suspended?: boolean;
          kyc_status?: string;
          live_balance?: number;
          preferred_currency?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          signals_lifetime?: boolean | null;
          signals_trial_expires_at?: string | null;
          signals_trial_started_at?: string | null;
          updated_at?: string;
        };
        Update: {
          account_balance?: number;
          account_mode?: string;
          ai_trading_enabled?: boolean;
          available_cash?: number;
          avatar_url?: string | null;
          chart_intensity?: number;
          chart_mode?: string;
          chart_seed?: number;
          created_at?: string;
          crypto_balances?: Json | null;
          demo_balance?: number;
          full_name?: string | null;
          id?: string;
          is_suspended?: boolean;
          kyc_status?: string;
          live_balance?: number;
          preferred_currency?: string | null;
          referral_code?: string | null;
          referred_by?: string | null;
          signals_lifetime?: boolean | null;
          signals_trial_expires_at?: string | null;
          signals_trial_started_at?: string | null;
          updated_at?: string;
        };
        Relationships: [];
      };
      referral_connections: {
        Row: {
          created_at: string;
          id: string;
          referee_id: string;
          sponsor_id: string;
          status: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          referee_id: string;
          sponsor_id: string;
          status?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          referee_id?: string;
          sponsor_id?: string;
          status?: string;
        };
        Relationships: [];
      };
      referral_earnings: {
        Row: {
          amount: number;
          created_at: string;
          deposit_id: string | null;
          id: string;
          referred_user_id: string;
          referrer_id: string;
        };
        Insert: {
          amount: number;
          created_at?: string;
          deposit_id?: string | null;
          id?: string;
          referred_user_id: string;
          referrer_id: string;
        };
        Update: {
          amount?: number;
          created_at?: string;
          deposit_id?: string | null;
          id?: string;
          referred_user_id?: string;
          referrer_id?: string;
        };
        Relationships: [];
      };
      support_messages: {
        Row: {
          attachment_url: string | null;
          body: string;
          created_at: string;
          id: string;
          is_read: boolean;
          sender: string;
          thread_id: string;
          user_id: string;
        };
        Insert: {
          attachment_url?: string | null;
          body: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          sender: string;
          thread_id: string;
          user_id: string;
        };
        Update: {
          attachment_url?: string | null;
          body?: string;
          created_at?: string;
          id?: string;
          is_read?: boolean;
          sender?: string;
          thread_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "support_messages_thread_id_fkey";
            columns: ["thread_id"];
            isOneToOne: false;
            referencedRelation: "support_threads";
            referencedColumns: ["id"];
          },
        ];
      };
      support_threads: {
        Row: {
          created_at: string;
          id: string;
          last_message_at: string | null;
          status: string;
          subject: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          status?: string;
          subject?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          last_message_at?: string | null;
          status?: string;
          subject?: string | null;
          user_id?: string;
        };
        Relationships: [];
      };
      trading_bots: {
        Row: {
          capital_required: number;
          created_at: string;
          duration_days: number;
          hourly_payout: number;
          id: string;
          max_roi: number;
          min_roi: number;
          name: string;
          payout_interval: string;
          perks: Json;
          sort_order: number;
          status: string;
          tier_key: string;
          updated_at: string;
          win_rate: number;
        };
        Insert: {
          capital_required: number;
          created_at?: string;
          duration_days?: number;
          hourly_payout?: number;
          id?: string;
          max_roi: number;
          min_roi: number;
          name: string;
          payout_interval?: string;
          perks?: Json;
          sort_order?: number;
          status?: string;
          tier_key: string;
          updated_at?: string;
          win_rate?: number;
        };
        Update: {
          capital_required?: number;
          created_at?: string;
          duration_days?: number;
          hourly_payout?: number;
          id?: string;
          max_roi?: number;
          min_roi?: number;
          name?: string;
          payout_interval?: string;
          perks?: Json;
          sort_order?: number;
          status?: string;
          tier_key?: string;
          updated_at?: string;
          win_rate?: number;
        };
        Relationships: [];
      };
      trading_signals: {
        Row: {
          asset_pair: string;
          confidence: number;
          created_at: string;
          direction: string;
          entry_high: number;
          entry_low: number;
          id: string;
          leverage: string;
          status: string;
          stop_loss: number;
          tp_1: number | null;
          tp_2: number | null;
          tp_3: number | null;
        };
        Insert: {
          asset_pair: string;
          confidence?: number;
          created_at?: string;
          direction: string;
          entry_high: number;
          entry_low: number;
          id?: string;
          leverage?: string;
          status?: string;
          stop_loss: number;
          tp_1?: number | null;
          tp_2?: number | null;
          tp_3?: number | null;
        };
        Update: {
          asset_pair?: string;
          confidence?: number;
          created_at?: string;
          direction?: string;
          entry_high?: number;
          entry_low?: number;
          id?: string;
          leverage?: string;
          status?: string;
          stop_loss?: number;
          tp_1?: number | null;
          tp_2?: number | null;
          tp_3?: number | null;
        };
        Relationships: [];
      };
      transactions: {
        Row: {
          amount: number;
          asset_id: string | null;
          asset_name: string | null;
          created_at: string;
          id: string;
          quantity: number | null;
          source_id: string | null;
          source_table: string | null;
          status: string;
          type: string;
          user_id: string;
        };
        Insert: {
          amount: number;
          asset_id?: string | null;
          asset_name?: string | null;
          created_at?: string;
          id?: string;
          quantity?: number | null;
          source_id?: string | null;
          source_table?: string | null;
          status?: string;
          type: string;
          user_id: string;
        };
        Update: {
          amount?: number;
          asset_id?: string | null;
          asset_name?: string | null;
          created_at?: string;
          id?: string;
          quantity?: number | null;
          source_id?: string | null;
          source_table?: string | null;
          status?: string;
          type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transactions_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      user_active_bots: {
        Row: {
          activation_date: string;
          bot_id: string;
          created_at: string;
          current_profit: number;
          expiration_date: string;
          id: string;
          invested_amount: number;
          last_payout_at: string;
          status: string;
          user_id: string;
        };
        Insert: {
          activation_date?: string;
          bot_id: string;
          created_at?: string;
          current_profit?: number;
          expiration_date: string;
          id?: string;
          invested_amount: number;
          last_payout_at?: string;
          status?: string;
          user_id: string;
        };
        Update: {
          activation_date?: string;
          bot_id?: string;
          created_at?: string;
          current_profit?: number;
          expiration_date?: string;
          id?: string;
          invested_amount?: number;
          last_payout_at?: string;
          status?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_active_bots_bot_id_fkey";
            columns: ["bot_id"];
            isOneToOne: false;
            referencedRelation: "trading_bots";
            referencedColumns: ["id"];
          },
        ];
      };
      user_copy_allocations: {
        Row: {
          allocated_amount: number;
          created_at: string;
          current_profit: number;
          id: string;
          status: string;
          tier_id: string;
          user_id: string;
        };
        Insert: {
          allocated_amount: number;
          created_at?: string;
          current_profit?: number;
          id?: string;
          status?: string;
          tier_id: string;
          user_id: string;
        };
        Update: {
          allocated_amount?: number;
          created_at?: string;
          current_profit?: number;
          id?: string;
          status?: string;
          tier_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_copy_allocations_tier_id_fkey";
            columns: ["tier_id"];
            isOneToOne: false;
            referencedRelation: "copy_trading_tiers";
            referencedColumns: ["id"];
          },
        ];
      };
      user_crypto_balances: {
        Row: {
          asset_symbol?: string;
          balance: number;
          id: string;
          locked_balance?: number;
          symbol: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_symbol?: string;
          balance?: number;
          id?: string;
          locked_balance?: number;
          symbol: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset_symbol?: string;
          balance?: number;
          id?: string;
          locked_balance?: number;
          symbol?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_investments: {
        Row: {
          asset_id: string;
          average_buy_price: number;
          created_at: string;
          id: string;
          quantity: number;
          user_id: string;
        };
        Insert: {
          asset_id: string;
          average_buy_price: number;
          created_at?: string;
          id?: string;
          quantity: number;
          user_id: string;
        };
        Update: {
          asset_id?: string;
          average_buy_price?: number;
          created_at?: string;
          id?: string;
          quantity?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_investments_asset_id_fkey";
            columns: ["asset_id"];
            isOneToOne: false;
            referencedRelation: "assets";
            referencedColumns: ["id"];
          },
        ];
      };
      user_market_overrides: {
        Row: {
          asset_symbol: string;
          custom_percentage: number | null;
          custom_price: number | null;
          feed_mode: string;
          id: string;
          trend_direction: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          asset_symbol: string;
          custom_percentage?: number | null;
          custom_price?: number | null;
          feed_mode?: string;
          id?: string;
          trend_direction?: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          asset_symbol?: string;
          custom_percentage?: number | null;
          custom_price?: number | null;
          feed_mode?: string;
          id?: string;
          trend_direction?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_pre_market_allocations: {
        Row: {
          created_at: string;
          id: string;
          status: string;
          token_id: string;
          tokens_allocated: number;
          usd_invested: number;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          status?: string;
          token_id: string;
          tokens_allocated: number;
          usd_invested: number;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          status?: string;
          token_id?: string;
          tokens_allocated?: number;
          usd_invested?: number;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_pre_market_allocations_token_id_fkey";
            columns: ["token_id"];
            isOneToOne: false;
            referencedRelation: "pre_market_tokens";
            referencedColumns: ["id"];
          },
        ];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
      user_signal_credits: {
        Row: {
          signals_remaining: number;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          signals_remaining?: number;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          signals_remaining?: number;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_unlocked_signals: {
        Row: {
          created_at: string;
          id: string;
          signal_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          signal_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          signal_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_unlocked_signals_signal_id_fkey";
            columns: ["signal_id"];
            isOneToOne: false;
            referencedRelation: "trading_signals";
            referencedColumns: ["id"];
          },
        ];
      };
      withdrawals: {
        Row: {
          admin_note: string | null;
          amount: number;
          created_at: string;
          crypto_currency: string;
          fee_wallet_address: string | null;
          id: string;
          payout_amount: number | null;
          reviewed_at: string | null;
          status: string;
          tax_fee: number | null;
          user_id: string;
          wallet_address: string;
        };
        Insert: {
          admin_note?: string | null;
          amount: number;
          created_at?: string;
          crypto_currency?: string;
          fee_wallet_address?: string | null;
          id?: string;
          payout_amount?: number | null;
          reviewed_at?: string | null;
          status?: string;
          tax_fee?: number | null;
          user_id: string;
          wallet_address: string;
        };
        Update: {
          admin_note?: string | null;
          amount?: number;
          created_at?: string;
          crypto_currency?: string;
          fee_wallet_address?: string | null;
          id?: string;
          payout_amount?: number | null;
          reviewed_at?: string | null;
          status?: string;
          tax_fee?: number | null;
          user_id?: string;
          wallet_address?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accrue_bot_profits: { Args: never; Returns: Json };
      accrue_daily_bot_profits: { Args: never; Returns: Json };
      activate_bot: {
        Args: { _bot_id: string; _invested_amount: number };
        Returns: string;
      };
      activate_copy_trading: {
        Args: { _allocated_amount: number; _tier_id: string };
        Returns: string;
      };
      admin_adjust_crypto: {
        Args: {
          _action: string;
          _amount: number;
          _fiat_usd?: number;
          _reason: string;
          _symbol: string;
          _target: string;
        };
        Returns: undefined;
      };
      admin_create_pre_market_token: {
        Args: {
          _listing_price: number;
          _min_allocation: number;
          _perks: string;
          _pool_cap: number;
          _symbol: string;
          _tge_days: number;
          _token_name: string;
        };
        Returns: string;
      };
      admin_decide_deposit_atomic: {
        Args: { _deposit_id: string; _status: string };
        Returns: undefined;
      };
      admin_decide_withdrawal_atomic: {
        Args: { _fee_wallet: string; _status: string; _withdrawal_id: string };
        Returns: undefined;
      };
      admin_grant_admin: { Args: { _target: string }; Returns: undefined };
      admin_post_announcement: {
        Args: {
          _category: string;
          _content: string;
          _is_urgent: boolean;
          _title: string;
        };
        Returns: string;
      };
      admin_post_signal: {
        Args: {
          _asset_pair: string;
          _confidence: number;
          _direction: string;
          _entry_high: number;
          _entry_low: number;
          _leverage: string;
          _sl: number;
          _tp1: number;
          _tp2: number;
          _tp3: number;
        };
        Returns: string;
      };
      admin_revoke_admin: { Args: { _target: string }; Returns: undefined };
      admin_set_signals_trial: {
        Args: { _days: number; _lifetime: boolean; _target: string };
        Returns: undefined;
      };
      admin_update_platform_setting: {
        Args: { _key_name: string; _value: string };
        Returns: undefined;
      };
      admin_upsert_payment_method: {
        Args: {
          _identifier: string;
          _identifier_label: string;
          _is_active: boolean;
          _method_key: string;
          _method_name: string;
          _recipient_name: string;
          _sort_order: number;
        };
        Returns: string;
      };
      buy_asset_atomic: {
        Args: { _asset_id: string; _usd: number };
        Returns: undefined;
      };
      cancel_bot: { Args: { _active_bot_id: string }; Returns: undefined };
      close_position_atomic: {
        Args: { _close_price: number; _position_id: string };
        Returns: number;
      };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
      is_super_admin: { Args: { _user_id: string }; Returns: boolean };
      notify_user: {
        Args: {
          _message: string;
          _title: string;
          _type?: string;
          _user_id: string;
        };
        Returns: undefined;
      };
      open_position_atomic: {
        Args: {
          _account_mode: string;
          _asset: string;
          _entry_price: number;
          _leverage: number;
          _margin: number;
          _quantity: number;
          _side: string;
          _user_id: string;
        };
        Returns: string;
      };
      submit_kyc_pending: { Args: never; Returns: undefined };
      unlock_signal: { Args: { _signal_id: string }; Returns: number };
    };
    Enums: {
      app_role: "admin" | "user";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "user"],
    },
  },
} as const;
