export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      server_plans: {
        Row: {
          created_at: string | null
          id: string
          plan: string
          server_id: string
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          plan?: string
          server_id: string
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          plan?: string
          server_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_plans_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: true
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      server_settings: {
        Row: {
          allow_fun_replies: boolean | null
          allow_proactive_replies: boolean | null
          behavior_mode: string | null
          created_at: string | null
          custom_personality_prompt: string | null
          discord_server_id: string | null
          enable_kb_ingestion: boolean | null
          enable_moderation: boolean | null
          id: string
          max_reply_tokens: number | null
          model_name: string | null
          personality_preset: string | null
          server_id: string
          updated_at: string | null
          use_knowledge_base: boolean | null
          user_id: string
        }
        Insert: {
          allow_fun_replies?: boolean | null
          allow_proactive_replies?: boolean | null
          behavior_mode?: string | null
          created_at?: string | null
          custom_personality_prompt?: string | null
          discord_server_id?: string | null
          enable_kb_ingestion?: boolean | null
          enable_moderation?: boolean | null
          id?: string
          max_reply_tokens?: number | null
          model_name?: string | null
          personality_preset?: string | null
          server_id: string
          updated_at?: string | null
          use_knowledge_base?: boolean | null
          user_id: string
        }
        Update: {
          allow_fun_replies?: boolean | null
          allow_proactive_replies?: boolean | null
          behavior_mode?: string | null
          created_at?: string | null
          custom_personality_prompt?: string | null
          discord_server_id?: string | null
          enable_kb_ingestion?: boolean | null
          enable_moderation?: boolean | null
          id?: string
          max_reply_tokens?: number | null
          model_name?: string | null
          personality_preset?: string | null
          server_id?: string
          updated_at?: string | null
          use_knowledge_base?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "server_settings_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "server_settings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      server_usage: {
        Row: {
          created_at: string | null
          cycle_end: string
          cycle_start: string
          discord_guild_id: string
          id: string
          messages: number | null
          server_id: string | null
        }
        Insert: {
          created_at?: string | null
          cycle_end?: string
          cycle_start?: string
          discord_guild_id: string
          id?: string
          messages?: number | null
          server_id?: string | null
        }
        Update: {
          created_at?: string | null
          cycle_end?: string
          cycle_start?: string
          discord_guild_id?: string
          id?: string
          messages?: number | null
          server_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "server_usage_server_id_fkey"
            columns: ["server_id"]
            isOneToOne: false
            referencedRelation: "servers"
            referencedColumns: ["id"]
          },
        ]
      }
      servers: {
        Row: {
          active: boolean | null
          bot_nickname: string | null
          created_at: string | null
          cycle_end: string | null
          cycle_start: string | null
          discord_guild_id: string
          icon_url: string | null
          id: string
          message_limit: number | null
          message_usage_current_cycle: number | null
          name: string
          owner_discord_id: string | null
          owner_id: string
          updated_at: string | null
        }
        Insert: {
          active?: boolean | null
          bot_nickname?: string | null
          created_at?: string | null
          cycle_end?: string | null
          cycle_start?: string | null
          discord_guild_id: string
          icon_url?: string | null
          id?: string
          message_limit?: number | null
          message_usage_current_cycle?: number | null
          name: string
          owner_discord_id?: string | null
          owner_id: string
          updated_at?: string | null
        }
        Update: {
          active?: boolean | null
          bot_nickname?: string | null
          created_at?: string | null
          cycle_end?: string | null
          cycle_start?: string | null
          discord_guild_id?: string
          icon_url?: string | null
          id?: string
          message_limit?: number | null
          message_usage_current_cycle?: number | null
          name?: string
          owner_discord_id?: string | null
          owner_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "servers_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "users"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      user_servers: {
        Row: {
          created_at: string | null
          discord_server_id: string
          discord_user_id: string
          id: string
        }
        Insert: {
          created_at?: string | null
          discord_server_id: string
          discord_user_id: string
          id?: string
        }
        Update: {
          created_at?: string | null
          discord_server_id?: string
          discord_user_id?: string
          id?: string
        }
        Relationships: []
      }
      users: {
        Row: {
          created_at: string | null
          discord_user_id: string | null
          email: string | null
          id: string
          plan: string | null
          stripe_customer_id: string | null
          updated_at: string | null
        }
        Insert: {
          created_at?: string | null
          discord_user_id?: string | null
          email?: string | null
          id: string
          plan?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Update: {
          created_at?: string | null
          discord_user_id?: string | null
          email?: string | null
          id?: string
          plan?: string | null
          stripe_customer_id?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "moderator" | "user"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "moderator", "user"],
    },
  },
} as const
