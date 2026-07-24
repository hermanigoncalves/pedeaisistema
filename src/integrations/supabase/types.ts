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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      admin_acessos: {
        Row: {
          created_at: string
          email: string | null
          id: number
          senha: string | null
        }
        Insert: {
          created_at?: string
          email?: string | null
          id?: number
          senha?: string | null
        }
        Update: {
          created_at?: string
          email?: string | null
          id?: number
          senha?: string | null
        }
        Relationships: []
      }
      estoque_restaurantes: {
        Row: {
          created_at: string
          id: number
          produto_id: number
          quantidade_atual: string | null
          restaurante_id: string
        }
        Insert: {
          created_at?: string
          id?: number
          produto_id: number
          quantidade_atual?: string | null
          restaurante_id: string
        }
        Update: {
          created_at?: string
          id?: number
          produto_id?: number
          quantidade_atual?: string | null
          restaurante_id?: string
        }
        Relationships: []
      }
      Pedidos: {
        Row: {
          created_at: string
          descricao: string | null
          id: number
          itens: string | null
          mesa: string | null
          quantidade: string | null
          restaurante_id: string | null
          status: string | null
          Subtotal: string | null
        }
        Insert: {
          created_at?: string
          descricao?: string | null
          id?: number
          itens?: string | null
          mesa?: string | null
          quantidade?: string | null
          restaurante_id?: string | null
          status?: string | null
          Subtotal?: string | null
        }
        Update: {
          created_at?: string
          descricao?: string | null
          id?: number
          itens?: string | null
          mesa?: string | null
          quantidade?: string | null
          restaurante_id?: string | null
          status?: string | null
          Subtotal?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Pedidos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "Restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      Produtos: {
        Row: {
          ativo: boolean | null
          categoria: string | null
          created_at: string
          descricao: string | null
          estacao: string | null
          estoque: number | null
          estoque_minimo: number | null
          id: number
          nome: string | null
          preco: string | null
          restaurante_id: string | null
        }
        Insert: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estacao?: string | null
          estoque?: number | null
          estoque_minimo?: number | null
          id?: number
          nome?: string | null
          preco?: string | null
          restaurante_id?: string | null
        }
        Update: {
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string
          descricao?: string | null
          estacao?: string | null
          estoque?: number | null
          estoque_minimo?: number | null
          id?: number
          nome?: string | null
          preco?: string | null
          restaurante_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "Produtos_restaurante_id_fkey"
            columns: ["restaurante_id"]
            isOneToOne: false
            referencedRelation: "Restaurantes"
            referencedColumns: ["id"]
          },
        ]
      }
      Restaurantes: {
        Row: {
          alerta_estoque_baixo: number | null
          alerta_estoque_critico: number | null
          alertas_piscantes: boolean | null
          created_at: string
          email: string | null
          fechar_mesa_auto: boolean | null
          horario_abertura: string | null
          horario_fecha_cozinha: string | null
          horario_fechamento: string | null
          id: string
          impressao_auto: boolean | null
          nome: string | null
          quantidade_max_mesas: string | null
          quantidade_mesas: string | null
          senha: string | null
          sons_habilitados: boolean | null
          telefone: string | null
          modo_cobranca: string | null
        }
        Insert: {
          alerta_estoque_baixo?: number | null
          alerta_estoque_critico?: number | null
          alertas_piscantes?: boolean | null
          created_at?: string
          email?: string | null
          fechar_mesa_auto?: boolean | null
          horario_abertura?: string | null
          horario_fecha_cozinha?: string | null
          horario_fechamento?: string | null
          id?: string
          impressao_auto?: boolean | null
          nome?: string | null
          quantidade_max_mesas?: string | null
          quantidade_mesas?: string | null
          senha?: string | null
          sons_habilitados?: boolean | null
          telefone?: string | null
          modo_cobranca?: string | null
        }
        Update: {
          alerta_estoque_baixo?: number | null
          alerta_estoque_critico?: number | null
          alertas_piscantes?: boolean | null
          created_at?: string
          email?: string | null
          fechar_mesa_auto?: boolean | null
          horario_abertura?: string | null
          horario_fecha_cozinha?: string | null
          horario_fechamento?: string | null
          id?: string
          impressao_auto?: boolean | null
          nome?: string | null
          quantidade_max_mesas?: string | null
          quantidade_mesas?: string | null
          senha?: string | null
          sons_habilitados?: boolean | null
          telefone?: string | null
          modo_cobranca?: string | null
        }
        Relationships: []
      }
      system_logs: {
        Row: {
          category: string
          created_at: string | null
          details: Json | null
          id: number
          ip_address: string | null
          level: string
          message: string
          restaurant_id: string | null
          user_agent: string | null
        }
        Insert: {
          category: string
          created_at?: string | null
          details?: Json | null
          id?: number
          ip_address?: string | null
          level: string
          message: string
          restaurant_id?: string | null
          user_agent?: string | null
        }
        Update: {
          category?: string
          created_at?: string | null
          details?: Json | null
          id?: number
          ip_address?: string | null
          level?: string
          message?: string
          restaurant_id?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      Usuários: {
        Row: {
          created_at: string
          id: number
          id_restaurante: string | null
          mesa_atual: string | null
          nome: string | null
          quantas_vezes_foi: string | null
          telefone: string | null
          Status: string | null
          ultimo_checkin: string | null
        }
        Insert: {
          created_at?: string
          id?: number
          id_restaurante?: string | null
          mesa_atual?: string | null
          nome?: string | null
          quantas_vezes_foi?: string | null
          telefone?: string | null
          Status?: string | null
          ultimo_checkin?: string | null
        }
        Update: {
          created_at?: string
          id?: number
          id_restaurante?: string | null
          mesa_atual?: string | null
          nome?: string | null
          quantas_vezes_foi?: string | null
          telefone?: string | null
          Status?: string | null
          ultimo_checkin?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      is_restaurant_owner: {
        Args: { restaurant_uuid: string }
        Returns: boolean
      }
      owns_order_restaurant: {
        Args: { order_restaurante_id: string }
        Returns: boolean
      }
      owns_product_restaurant: {
        Args: { product_restaurante_id: string }
        Returns: boolean
      }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
