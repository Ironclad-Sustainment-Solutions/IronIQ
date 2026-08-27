export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      actual_job_results: {
        Row: {
          actual_cycle_minutes: number | null;
          actual_material_cost: number | null;
          actual_programming_hours: number | null;
          actual_setup_hours: number | null;
          actual_tooling_cost: number | null;
          created_at: string;
          created_by: string | null;
          estimated_cycle_minutes: number | null;
          estimated_programming_hours: number | null;
          estimated_setup_hours: number | null;
          estimated_tooling_cost: number | null;
          historical_job_id: string;
          id: string;
          on_time: boolean | null;
          quoted_margin: number | null;
          quoted_material_cost: number | null;
          realized_margin: number | null;
          revision_count: number;
          root_cause_notes: string | null;
          scrap_or_rework: string | null;
          updated_at: string;
        };
        Insert: {
          actual_cycle_minutes?: number | null;
          actual_material_cost?: number | null;
          actual_programming_hours?: number | null;
          actual_setup_hours?: number | null;
          actual_tooling_cost?: number | null;
          created_at?: string;
          created_by?: string | null;
          estimated_cycle_minutes?: number | null;
          estimated_programming_hours?: number | null;
          estimated_setup_hours?: number | null;
          estimated_tooling_cost?: number | null;
          historical_job_id: string;
          id?: string;
          on_time?: boolean | null;
          quoted_margin?: number | null;
          quoted_material_cost?: number | null;
          realized_margin?: number | null;
          revision_count?: number;
          root_cause_notes?: string | null;
          scrap_or_rework?: string | null;
          updated_at?: string;
        };
        Update: {
          actual_cycle_minutes?: number | null;
          actual_material_cost?: number | null;
          actual_programming_hours?: number | null;
          actual_setup_hours?: number | null;
          actual_tooling_cost?: number | null;
          created_at?: string;
          created_by?: string | null;
          estimated_cycle_minutes?: number | null;
          estimated_programming_hours?: number | null;
          estimated_setup_hours?: number | null;
          estimated_tooling_cost?: number | null;
          historical_job_id?: string;
          id?: string;
          on_time?: boolean | null;
          quoted_margin?: number | null;
          quoted_material_cost?: number | null;
          realized_margin?: number | null;
          revision_count?: number;
          root_cause_notes?: string | null;
          scrap_or_rework?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "actual_job_results_historical_job_id_fkey";
            columns: ["historical_job_id"];
            isOneToOne: false;
            referencedRelation: "historical_jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_plans: {
        Row: {
          created_at: string;
          error: string | null;
          generated_at: string;
          generated_by: string | null;
          id: string;
          job_id: string;
          label: string;
          model: string;
          plan: Json;
        };
        Insert: {
          created_at?: string;
          error?: string | null;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          job_id: string;
          label?: string;
          model?: string;
          plan?: Json;
        };
        Update: {
          created_at?: string;
          error?: string | null;
          generated_at?: string;
          generated_by?: string | null;
          id?: string;
          job_id?: string;
          label?: string;
          model?: string;
          plan?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "ai_plans_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      ai_recommendation_decisions: {
        Row: {
          ai_plan_id: string | null;
          ai_value: string | null;
          decided_at: string;
          decided_by: string | null;
          decision: Database["public"]["Enums"]["recommendation_decision"];
          id: string;
          job_id: string;
          programmer_value: string | null;
          reason_code: string | null;
          reason_notes: string | null;
          recommendation_key: string;
          recommendation_label: string;
        };
        Insert: {
          ai_plan_id?: string | null;
          ai_value?: string | null;
          decided_at?: string;
          decided_by?: string | null;
          decision?: Database["public"]["Enums"]["recommendation_decision"];
          id?: string;
          job_id: string;
          programmer_value?: string | null;
          reason_code?: string | null;
          reason_notes?: string | null;
          recommendation_key: string;
          recommendation_label: string;
        };
        Update: {
          ai_plan_id?: string | null;
          ai_value?: string | null;
          decided_at?: string;
          decided_by?: string | null;
          decision?: Database["public"]["Enums"]["recommendation_decision"];
          id?: string;
          job_id?: string;
          programmer_value?: string | null;
          reason_code?: string | null;
          reason_notes?: string | null;
          recommendation_key?: string;
          recommendation_label?: string;
        };
        Relationships: [
          {
            foreignKeyName: "ai_recommendation_decisions_ai_plan_id_fkey";
            columns: ["ai_plan_id"];
            isOneToOne: false;
            referencedRelation: "ai_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ai_recommendation_decisions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_categories: {
        Row: {
          archived: boolean;
          code: string;
          created_at: string;
          description: string | null;
          id: string;
          name: string;
          sort_order: number;
          template_version_id: string;
          weight: number;
        };
        Insert: {
          archived?: boolean;
          code: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name: string;
          sort_order?: number;
          template_version_id: string;
          weight: number;
        };
        Update: {
          archived?: boolean;
          code?: string;
          created_at?: string;
          description?: string | null;
          id?: string;
          name?: string;
          sort_order?: number;
          template_version_id?: string;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_categories_template_version_id_fkey";
            columns: ["template_version_id"];
            isOneToOne: false;
            referencedRelation: "assessment_template_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_questions: {
        Row: {
          allow_not_applicable: boolean;
          archived: boolean;
          auto_finding: boolean;
          category_id: string;
          created_at: string;
          default_severity: Database["public"]["Enums"]["finding_severity"];
          guidance_text: string | null;
          id: string;
          is_critical: boolean;
          is_required: boolean;
          question_code: string;
          question_text: string;
          required_evidence:
            Database["public"]["Enums"]["evidence_type"] | null;
          sort_order: number;
          weight: number;
        };
        Insert: {
          allow_not_applicable?: boolean;
          archived?: boolean;
          auto_finding?: boolean;
          category_id: string;
          created_at?: string;
          default_severity?: Database["public"]["Enums"]["finding_severity"];
          guidance_text?: string | null;
          id?: string;
          is_critical?: boolean;
          is_required?: boolean;
          question_code: string;
          question_text: string;
          required_evidence?:
            Database["public"]["Enums"]["evidence_type"] | null;
          sort_order?: number;
          weight?: number;
        };
        Update: {
          allow_not_applicable?: boolean;
          archived?: boolean;
          auto_finding?: boolean;
          category_id?: string;
          created_at?: string;
          default_severity?: Database["public"]["Enums"]["finding_severity"];
          guidance_text?: string | null;
          id?: string;
          is_critical?: boolean;
          is_required?: boolean;
          question_code?: string;
          question_text?: string;
          required_evidence?:
            Database["public"]["Enums"]["evidence_type"] | null;
          sort_order?: number;
          weight?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_questions_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "assessment_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_responses: {
        Row: {
          answered_at: string | null;
          answered_by: string | null;
          assessment_id: string;
          comments: string | null;
          created_at: string;
          evidence_description: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          id: string;
          not_applicable: boolean;
          question_id: string;
          score: number | null;
          updated_at: string;
        };
        Insert: {
          answered_at?: string | null;
          answered_by?: string | null;
          assessment_id: string;
          comments?: string | null;
          created_at?: string;
          evidence_description?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          id?: string;
          not_applicable?: boolean;
          question_id: string;
          score?: number | null;
          updated_at?: string;
        };
        Update: {
          answered_at?: string | null;
          answered_by?: string | null;
          assessment_id?: string;
          comments?: string | null;
          created_at?: string;
          evidence_description?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          id?: string;
          not_applicable?: boolean;
          question_id?: string;
          score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_responses_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessment_responses_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "assessment_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_template_versions: {
        Row: {
          created_at: string;
          id: string;
          notes: string | null;
          published_at: string | null;
          published_by: string | null;
          status: Database["public"]["Enums"]["template_status"];
          template_id: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database["public"]["Enums"]["template_status"];
          template_id: string;
          updated_at?: string;
          version: number;
        };
        Update: {
          created_at?: string;
          id?: string;
          notes?: string | null;
          published_at?: string | null;
          published_by?: string | null;
          status?: Database["public"]["Enums"]["template_status"];
          template_id?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_template_versions_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "assessment_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      assessment_templates: {
        Row: {
          archived: boolean;
          assessment_type: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          industry: string | null;
          intended_use: string | null;
          name: string;
          owner_organization_id: string | null;
          status: Database["public"]["Enums"]["template_status"];
          template_code: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          archived?: boolean;
          assessment_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          industry?: string | null;
          intended_use?: string | null;
          name: string;
          owner_organization_id?: string | null;
          status?: Database["public"]["Enums"]["template_status"];
          template_code?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived?: boolean;
          assessment_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          industry?: string | null;
          intended_use?: string | null;
          name?: string;
          owner_organization_id?: string | null;
          status?: Database["public"]["Enums"]["template_status"];
          template_code?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessment_templates_owner_organization_id_fkey";
            columns: ["owner_organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      assessments: {
        Row: {
          archived: boolean;
          assessment_date: string;
          assessment_type: string | null;
          completion_pct: number | null;
          confidence_score: number | null;
          created_at: string;
          created_by: string | null;
          facility_id: string;
          finalized_at: string | null;
          finalized_by: string | null;
          has_critical_failure: boolean;
          id: string;
          lead_assessor: string | null;
          name: string;
          notes: string | null;
          organization_id: string;
          overall_score: number | null;
          product_family: string | null;
          production_area: string | null;
          readiness_level: string | null;
          scope: string | null;
          status: Database["public"]["Enums"]["assessment_status"];
          supporting_assessors: string[] | null;
          template_version_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          archived?: boolean;
          assessment_date?: string;
          assessment_type?: string | null;
          completion_pct?: number | null;
          confidence_score?: number | null;
          created_at?: string;
          created_by?: string | null;
          facility_id: string;
          finalized_at?: string | null;
          finalized_by?: string | null;
          has_critical_failure?: boolean;
          id?: string;
          lead_assessor?: string | null;
          name: string;
          notes?: string | null;
          organization_id: string;
          overall_score?: number | null;
          product_family?: string | null;
          production_area?: string | null;
          readiness_level?: string | null;
          scope?: string | null;
          status?: Database["public"]["Enums"]["assessment_status"];
          supporting_assessors?: string[] | null;
          template_version_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived?: boolean;
          assessment_date?: string;
          assessment_type?: string | null;
          completion_pct?: number | null;
          confidence_score?: number | null;
          created_at?: string;
          created_by?: string | null;
          facility_id?: string;
          finalized_at?: string | null;
          finalized_by?: string | null;
          has_critical_failure?: boolean;
          id?: string;
          lead_assessor?: string | null;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          overall_score?: number | null;
          product_family?: string | null;
          production_area?: string | null;
          readiness_level?: string | null;
          scope?: string | null;
          status?: Database["public"]["Enums"]["assessment_status"];
          supporting_assessors?: string[] | null;
          template_version_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "assessments_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "assessments_template_version_id_fkey";
            columns: ["template_version_id"];
            isOneToOne: false;
            referencedRelation: "assessment_template_versions";
            referencedColumns: ["id"];
          },
        ];
      };
      audit_logs: {
        Row: {
          action: string;
          actor_id: string | null;
          actor_name: string | null;
          created_at: string;
          details: Json;
          entity_id: string | null;
          entity_type: string;
          facility_id: string | null;
          id: string;
          organization_id: string | null;
        };
        Insert: {
          action: string;
          actor_id?: string | null;
          actor_name?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type: string;
          facility_id?: string | null;
          id?: string;
          organization_id?: string | null;
        };
        Update: {
          action?: string;
          actor_id?: string | null;
          actor_name?: string | null;
          created_at?: string;
          details?: Json;
          entity_id?: string | null;
          entity_type?: string;
          facility_id?: string | null;
          id?: string;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "audit_logs_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "audit_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      automated_checks: {
        Row: {
          check_key: string;
          check_label: string;
          detail: string | null;
          id: string;
          job_id: string;
          resolved: boolean;
          run_at: string;
          severity: Database["public"]["Enums"]["check_severity"];
        };
        Insert: {
          check_key: string;
          check_label: string;
          detail?: string | null;
          id?: string;
          job_id: string;
          resolved?: boolean;
          run_at?: string;
          severity?: Database["public"]["Enums"]["check_severity"];
        };
        Update: {
          check_key?: string;
          check_label?: string;
          detail?: string | null;
          id?: string;
          job_id?: string;
          resolved?: boolean;
          run_at?: string;
          severity?: Database["public"]["Enums"]["check_severity"];
        };
        Relationships: [
          {
            foreignKeyName: "automated_checks_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      cam_files: {
        Row: {
          bucket: string;
          checksum: string | null;
          created_at: string;
          created_by: string | null;
          file_kind: string;
          file_name: string;
          file_size: number;
          id: string;
          organization_id: string;
          revision: number;
          storage_path: string;
          work_order_id: string;
        };
        Insert: {
          bucket?: string;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_kind?: string;
          file_name: string;
          file_size?: number;
          id?: string;
          organization_id: string;
          revision?: number;
          storage_path: string;
          work_order_id: string;
        };
        Update: {
          bucket?: string;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_kind?: string;
          file_name?: string;
          file_size?: number;
          id?: string;
          organization_id?: string;
          revision?: number;
          storage_path?: string;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cam_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cam_files_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "programming_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_actions: {
        Row: {
          ai_generated: boolean;
          approved: boolean;
          assessment_id: string;
          baseline_value: number | null;
          capability_gap: string | null;
          confidence_rating: number | null;
          cost_exposure: number | null;
          created_at: string;
          created_by: string | null;
          delivery_exposure: number | null;
          dependencies: string | null;
          ease_of_restoration: number | null;
          estimated_effort: string | null;
          expected_benefit: number | null;
          expected_outcome: string | null;
          frequency_rating: number | null;
          id: string;
          impact_rating: number | null;
          metric_name: string | null;
          modified_by: string | null;
          priority: Database["public"]["Enums"]["cap_priority"];
          priority_override_justification: string | null;
          priority_score: number | null;
          quality_exposure: number | null;
          recommended_action: string;
          required_resources: string | null;
          responsible_party: string | null;
          root_gap_id: string | null;
          severity_rating: number | null;
          status: Database["public"]["Enums"]["cap_action_status"];
          target_date: string | null;
          target_value: number | null;
          unit: string | null;
          updated_at: string;
          urgency_rating: number | null;
          validation_method: string | null;
          workforce_dependency: number | null;
        };
        Insert: {
          ai_generated?: boolean;
          approved?: boolean;
          assessment_id: string;
          baseline_value?: number | null;
          capability_gap?: string | null;
          confidence_rating?: number | null;
          cost_exposure?: number | null;
          created_at?: string;
          created_by?: string | null;
          delivery_exposure?: number | null;
          dependencies?: string | null;
          ease_of_restoration?: number | null;
          estimated_effort?: string | null;
          expected_benefit?: number | null;
          expected_outcome?: string | null;
          frequency_rating?: number | null;
          id?: string;
          impact_rating?: number | null;
          metric_name?: string | null;
          modified_by?: string | null;
          priority?: Database["public"]["Enums"]["cap_priority"];
          priority_override_justification?: string | null;
          priority_score?: number | null;
          quality_exposure?: number | null;
          recommended_action: string;
          required_resources?: string | null;
          responsible_party?: string | null;
          root_gap_id?: string | null;
          severity_rating?: number | null;
          status?: Database["public"]["Enums"]["cap_action_status"];
          target_date?: string | null;
          target_value?: number | null;
          unit?: string | null;
          updated_at?: string;
          urgency_rating?: number | null;
          validation_method?: string | null;
          workforce_dependency?: number | null;
        };
        Update: {
          ai_generated?: boolean;
          approved?: boolean;
          assessment_id?: string;
          baseline_value?: number | null;
          capability_gap?: string | null;
          confidence_rating?: number | null;
          cost_exposure?: number | null;
          created_at?: string;
          created_by?: string | null;
          delivery_exposure?: number | null;
          dependencies?: string | null;
          ease_of_restoration?: number | null;
          estimated_effort?: string | null;
          expected_benefit?: number | null;
          expected_outcome?: string | null;
          frequency_rating?: number | null;
          id?: string;
          impact_rating?: number | null;
          metric_name?: string | null;
          modified_by?: string | null;
          priority?: Database["public"]["Enums"]["cap_priority"];
          priority_override_justification?: string | null;
          priority_score?: number | null;
          quality_exposure?: number | null;
          recommended_action?: string;
          required_resources?: string | null;
          responsible_party?: string | null;
          root_gap_id?: string | null;
          severity_rating?: number | null;
          status?: Database["public"]["Enums"]["cap_action_status"];
          target_date?: string | null;
          target_value?: number | null;
          unit?: string | null;
          updated_at?: string;
          urgency_rating?: number | null;
          validation_method?: string | null;
          workforce_dependency?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "cap_actions_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_actions_root_gap_id_fkey";
            columns: ["root_gap_id"];
            isOneToOne: false;
            referencedRelation: "cap_root_gaps";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_assessments: {
        Row: {
          assessment_date: string;
          created_at: string;
          created_by: string | null;
          facility_id: string | null;
          id: string;
          lead_assessor: string | null;
          modified_by: string | null;
          name: string;
          organization_id: string;
          overall_score: number | null;
          scope: string | null;
          status: Database["public"]["Enums"]["cap_assessment_status"];
          updated_at: string;
        };
        Insert: {
          assessment_date?: string;
          created_at?: string;
          created_by?: string | null;
          facility_id?: string | null;
          id?: string;
          lead_assessor?: string | null;
          modified_by?: string | null;
          name: string;
          organization_id: string;
          overall_score?: number | null;
          scope?: string | null;
          status?: Database["public"]["Enums"]["cap_assessment_status"];
          updated_at?: string;
        };
        Update: {
          assessment_date?: string;
          created_at?: string;
          created_by?: string | null;
          facility_id?: string | null;
          id?: string;
          lead_assessor?: string | null;
          modified_by?: string | null;
          name?: string;
          organization_id?: string;
          overall_score?: number | null;
          scope?: string | null;
          status?: Database["public"]["Enums"]["cap_assessment_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_assessments_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_assessments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_chain_nodes: {
        Row: {
          assessment_id: string;
          content: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          modified_by: string | null;
          organization_id: string | null;
          sort_order: number;
          step_key: string;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          modified_by?: string | null;
          organization_id?: string | null;
          sort_order?: number;
          step_key: string;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          content?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          modified_by?: string | null;
          organization_id?: string | null;
          sort_order?: number;
          step_key?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_chain_nodes_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_chain_nodes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_criteria: {
        Row: {
          created_at: string;
          description: string | null;
          domain_id: string;
          id: string;
          name: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          domain_id: string;
          id?: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          domain_id?: string;
          id?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_criteria_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_domain_screens: {
        Row: {
          assessment_id: string;
          created_at: string;
          created_by: string | null;
          domain_id: string;
          id: string;
          modified_by: string | null;
          notes: string | null;
          organization_id: string | null;
          screen_items: string[];
          status: string;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          created_at?: string;
          created_by?: string | null;
          domain_id: string;
          id?: string;
          modified_by?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          screen_items?: string[];
          status?: string;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          created_at?: string;
          created_by?: string | null;
          domain_id?: string;
          id?: string;
          modified_by?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          screen_items?: string[];
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_domain_screens_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_domain_screens_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_domain_screens_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_domains: {
        Row: {
          code: string;
          created_at: string;
          id: string;
          key_question: string;
          name: string;
          sort_order: number;
          updated_at: string;
          verb: string;
        };
        Insert: {
          code: string;
          created_at?: string;
          id?: string;
          key_question: string;
          name: string;
          sort_order?: number;
          updated_at?: string;
          verb: string;
        };
        Update: {
          code?: string;
          created_at?: string;
          id?: string;
          key_question?: string;
          name?: string;
          sort_order?: number;
          updated_at?: string;
          verb?: string;
        };
        Relationships: [];
      };
      cap_evidence: {
        Row: {
          captured_on: string | null;
          created_at: string;
          created_by: string | null;
          description: string | null;
          evidence_type: Database["public"]["Enums"]["cap_evidence_type"];
          file_path: string | null;
          finding_id: string;
          id: string;
          modified_by: string | null;
          source: string | null;
          updated_at: string;
        };
        Insert: {
          captured_on?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          evidence_type?: Database["public"]["Enums"]["cap_evidence_type"];
          file_path?: string | null;
          finding_id: string;
          id?: string;
          modified_by?: string | null;
          source?: string | null;
          updated_at?: string;
        };
        Update: {
          captured_on?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          evidence_type?: Database["public"]["Enums"]["cap_evidence_type"];
          file_path?: string | null;
          finding_id?: string;
          id?: string;
          modified_by?: string | null;
          source?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_evidence_finding_id_fkey";
            columns: ["finding_id"];
            isOneToOne: false;
            referencedRelation: "cap_findings";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_finding_links: {
        Row: {
          child_finding_id: string;
          created_at: string;
          id: string;
          parent_finding_id: string;
          relation: string;
        };
        Insert: {
          child_finding_id: string;
          created_at?: string;
          id?: string;
          parent_finding_id: string;
          relation?: string;
        };
        Update: {
          child_finding_id?: string;
          created_at?: string;
          id?: string;
          parent_finding_id?: string;
          relation?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_finding_links_child_finding_id_fkey";
            columns: ["child_finding_id"];
            isOneToOne: false;
            referencedRelation: "cap_findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_finding_links_parent_finding_id_fkey";
            columns: ["parent_finding_id"];
            isOneToOne: false;
            referencedRelation: "cap_findings";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_findings: {
        Row: {
          ai_generated: boolean;
          approved: boolean;
          approved_at: string | null;
          approved_by: string | null;
          assessment_id: string;
          assessor_notes: string | null;
          classification: Database["public"]["Enums"]["cap_finding_class"];
          client_visible: boolean;
          confidence: Database["public"]["Enums"]["cap_confidence"];
          created_at: string;
          created_by: string | null;
          criterion_id: string | null;
          dimension: Database["public"]["Enums"]["cap_dimension"] | null;
          domain_id: string | null;
          finding_text: string | null;
          frequency: string | null;
          id: string;
          modified_by: string | null;
          performance_impact: string | null;
          severity: Database["public"]["Enums"]["finding_severity"];
          source: Database["public"]["Enums"]["cap_source"];
          title: string;
          updated_at: string;
        };
        Insert: {
          ai_generated?: boolean;
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          assessment_id: string;
          assessor_notes?: string | null;
          classification?: Database["public"]["Enums"]["cap_finding_class"];
          client_visible?: boolean;
          confidence?: Database["public"]["Enums"]["cap_confidence"];
          created_at?: string;
          created_by?: string | null;
          criterion_id?: string | null;
          dimension?: Database["public"]["Enums"]["cap_dimension"] | null;
          domain_id?: string | null;
          finding_text?: string | null;
          frequency?: string | null;
          id?: string;
          modified_by?: string | null;
          performance_impact?: string | null;
          severity?: Database["public"]["Enums"]["finding_severity"];
          source?: Database["public"]["Enums"]["cap_source"];
          title: string;
          updated_at?: string;
        };
        Update: {
          ai_generated?: boolean;
          approved?: boolean;
          approved_at?: string | null;
          approved_by?: string | null;
          assessment_id?: string;
          assessor_notes?: string | null;
          classification?: Database["public"]["Enums"]["cap_finding_class"];
          client_visible?: boolean;
          confidence?: Database["public"]["Enums"]["cap_confidence"];
          created_at?: string;
          created_by?: string | null;
          criterion_id?: string | null;
          dimension?: Database["public"]["Enums"]["cap_dimension"] | null;
          domain_id?: string | null;
          finding_text?: string | null;
          frequency?: string | null;
          id?: string;
          modified_by?: string | null;
          performance_impact?: string | null;
          severity?: Database["public"]["Enums"]["finding_severity"];
          source?: Database["public"]["Enums"]["cap_source"];
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_findings_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_findings_criterion_id_fkey";
            columns: ["criterion_id"];
            isOneToOne: false;
            referencedRelation: "cap_criteria";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_findings_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_health_sweep: {
        Row: {
          assessment_id: string;
          classification: string;
          created_at: string;
          created_by: string | null;
          domain_id: string;
          id: string;
          modified_by: string | null;
          note: string | null;
          organization_id: string | null;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          classification?: string;
          created_at?: string;
          created_by?: string | null;
          domain_id: string;
          id?: string;
          modified_by?: string | null;
          note?: string | null;
          organization_id?: string | null;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          classification?: string;
          created_at?: string;
          created_by?: string | null;
          domain_id?: string;
          id?: string;
          modified_by?: string | null;
          note?: string | null;
          organization_id?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_health_sweep_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_health_sweep_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_health_sweep_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_metrics: {
        Row: {
          assessment_id: string;
          category: Database["public"]["Enums"]["cap_perf_category"];
          confidence: Database["public"]["Enums"]["cap_confidence"] | null;
          created_at: string;
          created_by: string | null;
          current_condition: string | null;
          current_value: number | null;
          data_source: string | null;
          higher_is_better: boolean;
          id: string;
          metric_name: string | null;
          modified_by: string | null;
          notes: string | null;
          organization_id: string | null;
          other_label: string | null;
          required_value: number | null;
          target_value: number | null;
          time_period: string | null;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          category: Database["public"]["Enums"]["cap_perf_category"];
          confidence?: Database["public"]["Enums"]["cap_confidence"] | null;
          created_at?: string;
          created_by?: string | null;
          current_condition?: string | null;
          current_value?: number | null;
          data_source?: string | null;
          higher_is_better?: boolean;
          id?: string;
          metric_name?: string | null;
          modified_by?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          other_label?: string | null;
          required_value?: number | null;
          target_value?: number | null;
          time_period?: string | null;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          category?: Database["public"]["Enums"]["cap_perf_category"];
          confidence?: Database["public"]["Enums"]["cap_confidence"] | null;
          created_at?: string;
          created_by?: string | null;
          current_condition?: string | null;
          current_value?: number | null;
          data_source?: string | null;
          higher_is_better?: boolean;
          id?: string;
          metric_name?: string | null;
          modified_by?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          other_label?: string | null;
          required_value?: number | null;
          target_value?: number | null;
          time_period?: string | null;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_metrics_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_metrics_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_observations: {
        Row: {
          area_process: string | null;
          assessment_id: string;
          assessor_notes: string | null;
          created_at: string;
          created_by: string | null;
          domain_id: string | null;
          evidence_note: string | null;
          evidence_type:
            Database["public"]["Enums"]["cap_evidence_type"] | null;
          file_path: string | null;
          frequency: string | null;
          id: string;
          machine_cell: string | null;
          modified_by: string | null;
          observation: string;
          organization_id: string | null;
          performance_effect: string | null;
          severity: string | null;
          updated_at: string;
        };
        Insert: {
          area_process?: string | null;
          assessment_id: string;
          assessor_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_id?: string | null;
          evidence_note?: string | null;
          evidence_type?:
            Database["public"]["Enums"]["cap_evidence_type"] | null;
          file_path?: string | null;
          frequency?: string | null;
          id?: string;
          machine_cell?: string | null;
          modified_by?: string | null;
          observation: string;
          organization_id?: string | null;
          performance_effect?: string | null;
          severity?: string | null;
          updated_at?: string;
        };
        Update: {
          area_process?: string | null;
          assessment_id?: string;
          assessor_notes?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_id?: string | null;
          evidence_note?: string | null;
          evidence_type?:
            Database["public"]["Enums"]["cap_evidence_type"] | null;
          file_path?: string | null;
          frequency?: string | null;
          id?: string;
          machine_cell?: string | null;
          modified_by?: string | null;
          observation?: string;
          organization_id?: string | null;
          performance_effect?: string | null;
          severity?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_observations_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_observations_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_observations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_performance_impacts: {
        Row: {
          assessment_id: string;
          assessor_notes: string | null;
          category: Database["public"]["Enums"]["cap_perf_category"];
          created_at: string;
          created_by: string | null;
          current_condition: string | null;
          current_value: number | null;
          data_source: string | null;
          desired_condition: string | null;
          evidence: string | null;
          id: string;
          metric_name: string | null;
          modified_by: string | null;
          target_value: number | null;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          assessor_notes?: string | null;
          category: Database["public"]["Enums"]["cap_perf_category"];
          created_at?: string;
          created_by?: string | null;
          current_condition?: string | null;
          current_value?: number | null;
          data_source?: string | null;
          desired_condition?: string | null;
          evidence?: string | null;
          id?: string;
          metric_name?: string | null;
          modified_by?: string | null;
          target_value?: number | null;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          assessor_notes?: string | null;
          category?: Database["public"]["Enums"]["cap_perf_category"];
          created_at?: string;
          created_by?: string | null;
          current_condition?: string | null;
          current_value?: number | null;
          data_source?: string | null;
          desired_condition?: string | null;
          evidence?: string | null;
          id?: string;
          metric_name?: string | null;
          modified_by?: string | null;
          target_value?: number | null;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_performance_impacts_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_primary_constraints: {
        Row: {
          assessment_id: string;
          confidence: Database["public"]["Enums"]["cap_confidence"] | null;
          constraint_text: string | null;
          created_at: string;
          created_by: string | null;
          declared_at: string | null;
          declared_by: string | null;
          domain_id: string | null;
          id: string;
          magnitude: string | null;
          metric_affected: string | null;
          modified_by: string | null;
          organization_id: string | null;
          supporting_evidence: string | null;
          updated_at: string;
          validation_status: string;
        };
        Insert: {
          assessment_id: string;
          confidence?: Database["public"]["Enums"]["cap_confidence"] | null;
          constraint_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          declared_at?: string | null;
          declared_by?: string | null;
          domain_id?: string | null;
          id?: string;
          magnitude?: string | null;
          metric_affected?: string | null;
          modified_by?: string | null;
          organization_id?: string | null;
          supporting_evidence?: string | null;
          updated_at?: string;
          validation_status?: string;
        };
        Update: {
          assessment_id?: string;
          confidence?: Database["public"]["Enums"]["cap_confidence"] | null;
          constraint_text?: string | null;
          created_at?: string;
          created_by?: string | null;
          declared_at?: string | null;
          declared_by?: string | null;
          domain_id?: string | null;
          id?: string;
          magnitude?: string | null;
          metric_affected?: string | null;
          modified_by?: string | null;
          organization_id?: string | null;
          supporting_evidence?: string | null;
          updated_at?: string;
          validation_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_primary_constraints_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: true;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_primary_constraints_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_primary_constraints_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_problems: {
        Row: {
          ai_summary_pending: boolean;
          assessment_id: string;
          created_at: string;
          created_by: string | null;
          desired_outcome: string | null;
          entered_by_role: string | null;
          id: string;
          location_process: string | null;
          modified_by: string | null;
          performance_impact: string | null;
          previous_actions: string | null;
          q_effect: string | null;
          q_greatest_impact: string | null;
          q_if_resolved: string | null;
          q_tried: string | null;
          q_where_when: string | null;
          stated_problem: string | null;
          updated_at: string;
        };
        Insert: {
          ai_summary_pending?: boolean;
          assessment_id: string;
          created_at?: string;
          created_by?: string | null;
          desired_outcome?: string | null;
          entered_by_role?: string | null;
          id?: string;
          location_process?: string | null;
          modified_by?: string | null;
          performance_impact?: string | null;
          previous_actions?: string | null;
          q_effect?: string | null;
          q_greatest_impact?: string | null;
          q_if_resolved?: string | null;
          q_tried?: string | null;
          q_where_when?: string | null;
          stated_problem?: string | null;
          updated_at?: string;
        };
        Update: {
          ai_summary_pending?: boolean;
          assessment_id?: string;
          created_at?: string;
          created_by?: string | null;
          desired_outcome?: string | null;
          entered_by_role?: string | null;
          id?: string;
          location_process?: string | null;
          modified_by?: string | null;
          performance_impact?: string | null;
          previous_actions?: string | null;
          q_effect?: string | null;
          q_greatest_impact?: string | null;
          q_if_resolved?: string | null;
          q_tried?: string | null;
          q_where_when?: string | null;
          stated_problem?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_problems_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_reference_access: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          note: string | null;
          role: Database["public"]["Enums"]["app_role"] | null;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          note?: string | null;
          role?: Database["public"]["Enums"]["app_role"] | null;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [];
      };
      cap_reports: {
        Row: {
          assessment_id: string;
          created_at: string;
          created_by: string | null;
          generated_at: string;
          id: string;
          modified_by: string | null;
          sections: Json;
          title: string;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          created_at?: string;
          created_by?: string | null;
          generated_at?: string;
          id?: string;
          modified_by?: string | null;
          sections?: Json;
          title: string;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          created_at?: string;
          created_by?: string | null;
          generated_at?: string;
          id?: string;
          modified_by?: string | null;
          sections?: Json;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_reports_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_results: {
        Row: {
          action_id: string;
          actual_value: number;
          created_at: string;
          created_by: string | null;
          id: string;
          measured_on: string;
          modified_by: string | null;
          notes: string | null;
          updated_at: string;
        };
        Insert: {
          action_id: string;
          actual_value: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          measured_on?: string;
          modified_by?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Update: {
          action_id?: string;
          actual_value?: number;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          measured_on?: string;
          modified_by?: string | null;
          notes?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_results_action_id_fkey";
            columns: ["action_id"];
            isOneToOne: false;
            referencedRelation: "cap_actions";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_root_gaps: {
        Row: {
          assessment_id: string;
          confidence: Database["public"]["Enums"]["cap_confidence"];
          contributing_factors: string | null;
          created_at: string;
          created_by: string | null;
          dimension: Database["public"]["Enums"]["cap_dimension"] | null;
          domain_id: string | null;
          id: string;
          immediate_cause: string | null;
          modified_by: string | null;
          observed_problem: string;
          operational_consequence: string | null;
          primary_finding_id: string | null;
          root_gap: string;
          updated_at: string;
          validated: boolean;
        };
        Insert: {
          assessment_id: string;
          confidence?: Database["public"]["Enums"]["cap_confidence"];
          contributing_factors?: string | null;
          created_at?: string;
          created_by?: string | null;
          dimension?: Database["public"]["Enums"]["cap_dimension"] | null;
          domain_id?: string | null;
          id?: string;
          immediate_cause?: string | null;
          modified_by?: string | null;
          observed_problem: string;
          operational_consequence?: string | null;
          primary_finding_id?: string | null;
          root_gap: string;
          updated_at?: string;
          validated?: boolean;
        };
        Update: {
          assessment_id?: string;
          confidence?: Database["public"]["Enums"]["cap_confidence"];
          contributing_factors?: string | null;
          created_at?: string;
          created_by?: string | null;
          dimension?: Database["public"]["Enums"]["cap_dimension"] | null;
          domain_id?: string | null;
          id?: string;
          immediate_cause?: string | null;
          modified_by?: string | null;
          observed_problem?: string;
          operational_consequence?: string | null;
          primary_finding_id?: string | null;
          root_gap?: string;
          updated_at?: string;
          validated?: boolean;
        };
        Relationships: [
          {
            foreignKeyName: "cap_root_gaps_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_root_gaps_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_root_gaps_primary_finding_id_fkey";
            columns: ["primary_finding_id"];
            isOneToOne: false;
            referencedRelation: "cap_findings";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_scores: {
        Row: {
          assessment_id: string;
          assessor_notes: string | null;
          confidence: Database["public"]["Enums"]["cap_confidence"] | null;
          created_at: string;
          created_by: string | null;
          criterion_id: string;
          dimension: Database["public"]["Enums"]["cap_dimension"];
          evidence: string | null;
          id: string;
          modified_by: string | null;
          not_applicable: boolean;
          performance_impact: string | null;
          rationale: string | null;
          score: number | null;
          updated_at: string;
        };
        Insert: {
          assessment_id: string;
          assessor_notes?: string | null;
          confidence?: Database["public"]["Enums"]["cap_confidence"] | null;
          created_at?: string;
          created_by?: string | null;
          criterion_id: string;
          dimension: Database["public"]["Enums"]["cap_dimension"];
          evidence?: string | null;
          id?: string;
          modified_by?: string | null;
          not_applicable?: boolean;
          performance_impact?: string | null;
          rationale?: string | null;
          score?: number | null;
          updated_at?: string;
        };
        Update: {
          assessment_id?: string;
          assessor_notes?: string | null;
          confidence?: Database["public"]["Enums"]["cap_confidence"] | null;
          created_at?: string;
          created_by?: string | null;
          criterion_id?: string;
          dimension?: Database["public"]["Enums"]["cap_dimension"];
          evidence?: string | null;
          id?: string;
          modified_by?: string | null;
          not_applicable?: boolean;
          performance_impact?: string | null;
          rationale?: string | null;
          score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_scores_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "cap_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "cap_scores_criterion_id_fkey";
            columns: ["criterion_id"];
            isOneToOne: false;
            referencedRelation: "cap_criteria";
            referencedColumns: ["id"];
          },
        ];
      };
      cap_validations: {
        Row: {
          action_id: string;
          capability_stable: boolean | null;
          created_at: string;
          created_by: string | null;
          id: string;
          improvement_holding: boolean | null;
          interval_days: number;
          knowledge_documented: boolean | null;
          modified_by: string | null;
          notes: string | null;
          others_can_execute: boolean | null;
          performance_measured: boolean | null;
          process_controlled: boolean | null;
          repeatable: boolean | null;
          result: Database["public"]["Enums"]["cap_validation_result"];
          updated_at: string;
          validated_by: string | null;
          validated_on: string;
        };
        Insert: {
          action_id: string;
          capability_stable?: boolean | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          improvement_holding?: boolean | null;
          interval_days?: number;
          knowledge_documented?: boolean | null;
          modified_by?: string | null;
          notes?: string | null;
          others_can_execute?: boolean | null;
          performance_measured?: boolean | null;
          process_controlled?: boolean | null;
          repeatable?: boolean | null;
          result?: Database["public"]["Enums"]["cap_validation_result"];
          updated_at?: string;
          validated_by?: string | null;
          validated_on?: string;
        };
        Update: {
          action_id?: string;
          capability_stable?: boolean | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          improvement_holding?: boolean | null;
          interval_days?: number;
          knowledge_documented?: boolean | null;
          modified_by?: string | null;
          notes?: string | null;
          others_can_execute?: boolean | null;
          performance_measured?: boolean | null;
          process_controlled?: boolean | null;
          repeatable?: boolean | null;
          result?: Database["public"]["Enums"]["cap_validation_result"];
          updated_at?: string;
          validated_by?: string | null;
          validated_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "cap_validations_action_id_fkey";
            columns: ["action_id"];
            isOneToOne: false;
            referencedRelation: "cap_actions";
            referencedColumns: ["id"];
          },
        ];
      };
      corrective_actions: {
        Row: {
          action_description: string;
          completed_date: string | null;
          created_at: string;
          created_by: string | null;
          facility_id: string;
          finding_id: string;
          id: string;
          owner: string | null;
          status: Database["public"]["Enums"]["finding_status"];
          target_date: string | null;
          updated_at: string;
          verification_notes: string | null;
        };
        Insert: {
          action_description: string;
          completed_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          facility_id: string;
          finding_id: string;
          id?: string;
          owner?: string | null;
          status?: Database["public"]["Enums"]["finding_status"];
          target_date?: string | null;
          updated_at?: string;
          verification_notes?: string | null;
        };
        Update: {
          action_description?: string;
          completed_date?: string | null;
          created_at?: string;
          created_by?: string | null;
          facility_id?: string;
          finding_id?: string;
          id?: string;
          owner?: string | null;
          status?: Database["public"]["Enums"]["finding_status"];
          target_date?: string | null;
          updated_at?: string;
          verification_notes?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "corrective_actions_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "corrective_actions_finding_id_fkey";
            columns: ["finding_id"];
            isOneToOne: false;
            referencedRelation: "findings";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_assumptions: {
        Row: {
          assumption: string;
          created_at: string;
          created_by: string | null;
          estimate_id: string;
          id: string;
          source: string | null;
        };
        Insert: {
          assumption: string;
          created_at?: string;
          created_by?: string | null;
          estimate_id: string;
          id?: string;
          source?: string | null;
        };
        Update: {
          assumption?: string;
          created_at?: string;
          created_by?: string | null;
          estimate_id?: string;
          id?: string;
          source?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_assumptions_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimate_line_items: {
        Row: {
          assumption: string | null;
          calculated_value: number;
          category: string;
          created_at: string;
          estimate_id: string;
          id: string;
          label: string;
          line_key: string;
          original_value: number | null;
          overridden: boolean;
          overridden_at: string | null;
          overridden_by: string | null;
          override_reason: string | null;
          sort_order: number;
          source: string;
          updated_at: string;
          value: number;
        };
        Insert: {
          assumption?: string | null;
          calculated_value?: number;
          category?: string;
          created_at?: string;
          estimate_id: string;
          id?: string;
          label: string;
          line_key: string;
          original_value?: number | null;
          overridden?: boolean;
          overridden_at?: string | null;
          overridden_by?: string | null;
          override_reason?: string | null;
          sort_order?: number;
          source: string;
          updated_at?: string;
          value?: number;
        };
        Update: {
          assumption?: string | null;
          calculated_value?: number;
          category?: string;
          created_at?: string;
          estimate_id?: string;
          id?: string;
          label?: string;
          line_key?: string;
          original_value?: number | null;
          overridden?: boolean;
          overridden_at?: string | null;
          overridden_by?: string | null;
          override_reason?: string | null;
          sort_order?: number;
          source?: string;
          updated_at?: string;
          value?: number;
        };
        Relationships: [
          {
            foreignKeyName: "estimate_line_items_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
        ];
      };
      estimates: {
        Row: {
          confidence: Database["public"]["Enums"]["estimate_confidence"];
          created_at: string;
          created_by: string | null;
          cycle_time_minutes: number;
          estimator_notes: string | null;
          facility_id: string | null;
          id: string;
          machine_id: string | null;
          manual_review_reasons: Json;
          organization_id: string;
          programming_hours: number;
          quantity: number;
          recommended_price: number;
          rfq_id: string;
          rfq_part_id: string;
          setup_count: number;
          setup_hours: number;
          status: string;
          target_margin: number;
          total_cost: number;
          updated_at: string;
        };
        Insert: {
          confidence?: Database["public"]["Enums"]["estimate_confidence"];
          created_at?: string;
          created_by?: string | null;
          cycle_time_minutes?: number;
          estimator_notes?: string | null;
          facility_id?: string | null;
          id?: string;
          machine_id?: string | null;
          manual_review_reasons?: Json;
          organization_id: string;
          programming_hours?: number;
          quantity?: number;
          recommended_price?: number;
          rfq_id: string;
          rfq_part_id: string;
          setup_count?: number;
          setup_hours?: number;
          status?: string;
          target_margin?: number;
          total_cost?: number;
          updated_at?: string;
        };
        Update: {
          confidence?: Database["public"]["Enums"]["estimate_confidence"];
          created_at?: string;
          created_by?: string | null;
          cycle_time_minutes?: number;
          estimator_notes?: string | null;
          facility_id?: string | null;
          id?: string;
          machine_id?: string | null;
          manual_review_reasons?: Json;
          organization_id?: string;
          programming_hours?: number;
          quantity?: number;
          recommended_price?: number;
          rfq_id?: string;
          rfq_part_id?: string;
          setup_count?: number;
          setup_hours?: number;
          status?: string;
          target_margin?: number;
          total_cost?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "estimates_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "estimates_rfq_part_id_fkey";
            columns: ["rfq_part_id"];
            isOneToOne: false;
            referencedRelation: "rfq_parts";
            referencedColumns: ["id"];
          },
        ];
      };
      evidence: {
        Row: {
          created_at: string;
          description: string | null;
          evidence_type: Database["public"]["Enums"]["evidence_type"];
          file_name: string;
          id: string;
          response_id: string;
          storage_path: string | null;
          uploaded_by: string | null;
        };
        Insert: {
          created_at?: string;
          description?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          file_name: string;
          id?: string;
          response_id: string;
          storage_path?: string | null;
          uploaded_by?: string | null;
        };
        Update: {
          created_at?: string;
          description?: string | null;
          evidence_type?: Database["public"]["Enums"]["evidence_type"];
          file_name?: string;
          id?: string;
          response_id?: string;
          storage_path?: string | null;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "evidence_response_id_fkey";
            columns: ["response_id"];
            isOneToOne: false;
            referencedRelation: "assessment_responses";
            referencedColumns: ["id"];
          },
        ];
      };
      facilities: {
        Row: {
          address: string | null;
          archived: boolean;
          certifications: string[] | null;
          created_at: string;
          created_by: string | null;
          current_readiness_score: number | null;
          employee_count: number | null;
          id: string;
          last_assessment_date: string | null;
          machine_count: number | null;
          name: string;
          operating_shifts: number | null;
          organization_id: string;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          primary_processes: string | null;
          primary_products: string | null;
          status: Database["public"]["Enums"]["entity_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          address?: string | null;
          archived?: boolean;
          certifications?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          current_readiness_score?: number | null;
          employee_count?: number | null;
          id?: string;
          last_assessment_date?: string | null;
          machine_count?: number | null;
          name: string;
          operating_shifts?: number | null;
          organization_id: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_processes?: string | null;
          primary_products?: string | null;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          address?: string | null;
          archived?: boolean;
          certifications?: string[] | null;
          created_at?: string;
          created_by?: string | null;
          current_readiness_score?: number | null;
          employee_count?: number | null;
          id?: string;
          last_assessment_date?: string | null;
          machine_count?: number | null;
          name?: string;
          operating_shifts?: number | null;
          organization_id?: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_processes?: string | null;
          primary_products?: string | null;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "facilities_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      facility_members: {
        Row: {
          created_at: string;
          facility_id: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          facility_id: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          facility_id?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "facility_members_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ];
      };
      field_assessment_ratings: {
        Row: {
          created_at: string;
          domain_id: string;
          field_assessment_id: string;
          id: string;
          needs_action: boolean;
          not_applicable: boolean;
          note: string | null;
          score: number | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          domain_id: string;
          field_assessment_id: string;
          id?: string;
          needs_action?: boolean;
          not_applicable?: boolean;
          note?: string | null;
          score?: number | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          domain_id?: string;
          field_assessment_id?: string;
          id?: string;
          needs_action?: boolean;
          not_applicable?: boolean;
          note?: string | null;
          score?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_assessment_ratings_domain_id_fkey";
            columns: ["domain_id"];
            isOneToOne: false;
            referencedRelation: "cap_domains";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_assessment_ratings_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_assessments: {
        Row: {
          area: string;
          assessment_date: string;
          assessment_lead: string | null;
          assessment_name: string | null;
          assessment_status: string;
          assessors: string | null;
          attempted: string | null;
          baseline_statuses: Json;
          capability_score: number | null;
          client_contact: string | null;
          client_contact_title: string | null;
          client_name: string | null;
          client_summary: string | null;
          created_at: string;
          created_by: string | null;
          day_focus: string | null;
          est_impact_notes: string | null;
          est_lost_hours_week: number | null;
          executive_summary: string | null;
          facility_id: string | null;
          facility_location: string | null;
          facility_name: string | null;
          id: string;
          impact_notes: string | null;
          impact_other: string | null;
          impact_tags: string[];
          improvement_if_resolved: string | null;
          known_machines: string | null;
          known_parts: string | null;
          known_smes: string | null;
          meeting_data_promised: string | null;
          meeting_decision: string | null;
          meeting_new_gaps: string | null;
          meeting_new_info: string | null;
          meeting_next_action: string | null;
          meeting_owner: string | null;
          meeting_projects: string | null;
          meeting_scope: string | null;
          meeting_target_date: string | null;
          notes: string | null;
          objective: string | null;
          observed_at: string;
          observer_name: string | null;
          organization_id: string;
          preliminary_conclusion: string | null;
          primary_concern: string | null;
          primary_operational_question: string | null;
          problem_area: string | null;
          problem_cell: string | null;
          problem_department: string | null;
          problem_machine: string | null;
          problem_process: string | null;
          problem_statement: string | null;
          problem_timing: string | null;
          rec_deeper_helps: boolean | null;
          rec_in_scope: boolean | null;
          rec_measurable_impact: boolean | null;
          rec_significant_constraints: boolean | null;
          rec_unvalidated: boolean | null;
          recommendation: string | null;
          recommended_path: string | null;
          review_attendees: string | null;
          review_meeting_date: string | null;
          review_notes: string | null;
          shift: string | null;
          start_date: string | null;
          status: string;
          summary_constraint: string | null;
          summary_observed: string | null;
          summary_opportunity: string | null;
          summary_outcome: string | null;
          summary_recommendation: string | null;
          summary_why: string | null;
          target_completion_date: string | null;
          team_members: string | null;
          updated_at: string;
          work_center: string | null;
          workstreams: string[];
        };
        Insert: {
          area?: string;
          assessment_date?: string;
          assessment_lead?: string | null;
          assessment_name?: string | null;
          assessment_status?: string;
          assessors?: string | null;
          attempted?: string | null;
          baseline_statuses?: Json;
          capability_score?: number | null;
          client_contact?: string | null;
          client_contact_title?: string | null;
          client_name?: string | null;
          client_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          day_focus?: string | null;
          est_impact_notes?: string | null;
          est_lost_hours_week?: number | null;
          executive_summary?: string | null;
          facility_id?: string | null;
          facility_location?: string | null;
          facility_name?: string | null;
          id?: string;
          impact_notes?: string | null;
          impact_other?: string | null;
          impact_tags?: string[];
          improvement_if_resolved?: string | null;
          known_machines?: string | null;
          known_parts?: string | null;
          known_smes?: string | null;
          meeting_data_promised?: string | null;
          meeting_decision?: string | null;
          meeting_new_gaps?: string | null;
          meeting_new_info?: string | null;
          meeting_next_action?: string | null;
          meeting_owner?: string | null;
          meeting_projects?: string | null;
          meeting_scope?: string | null;
          meeting_target_date?: string | null;
          notes?: string | null;
          objective?: string | null;
          observed_at?: string;
          observer_name?: string | null;
          organization_id: string;
          preliminary_conclusion?: string | null;
          primary_concern?: string | null;
          primary_operational_question?: string | null;
          problem_area?: string | null;
          problem_cell?: string | null;
          problem_department?: string | null;
          problem_machine?: string | null;
          problem_process?: string | null;
          problem_statement?: string | null;
          problem_timing?: string | null;
          rec_deeper_helps?: boolean | null;
          rec_in_scope?: boolean | null;
          rec_measurable_impact?: boolean | null;
          rec_significant_constraints?: boolean | null;
          rec_unvalidated?: boolean | null;
          recommendation?: string | null;
          recommended_path?: string | null;
          review_attendees?: string | null;
          review_meeting_date?: string | null;
          review_notes?: string | null;
          shift?: string | null;
          start_date?: string | null;
          status?: string;
          summary_constraint?: string | null;
          summary_observed?: string | null;
          summary_opportunity?: string | null;
          summary_outcome?: string | null;
          summary_recommendation?: string | null;
          summary_why?: string | null;
          target_completion_date?: string | null;
          team_members?: string | null;
          updated_at?: string;
          work_center?: string | null;
          workstreams?: string[];
        };
        Update: {
          area?: string;
          assessment_date?: string;
          assessment_lead?: string | null;
          assessment_name?: string | null;
          assessment_status?: string;
          assessors?: string | null;
          attempted?: string | null;
          baseline_statuses?: Json;
          capability_score?: number | null;
          client_contact?: string | null;
          client_contact_title?: string | null;
          client_name?: string | null;
          client_summary?: string | null;
          created_at?: string;
          created_by?: string | null;
          day_focus?: string | null;
          est_impact_notes?: string | null;
          est_lost_hours_week?: number | null;
          executive_summary?: string | null;
          facility_id?: string | null;
          facility_location?: string | null;
          facility_name?: string | null;
          id?: string;
          impact_notes?: string | null;
          impact_other?: string | null;
          impact_tags?: string[];
          improvement_if_resolved?: string | null;
          known_machines?: string | null;
          known_parts?: string | null;
          known_smes?: string | null;
          meeting_data_promised?: string | null;
          meeting_decision?: string | null;
          meeting_new_gaps?: string | null;
          meeting_new_info?: string | null;
          meeting_next_action?: string | null;
          meeting_owner?: string | null;
          meeting_projects?: string | null;
          meeting_scope?: string | null;
          meeting_target_date?: string | null;
          notes?: string | null;
          objective?: string | null;
          observed_at?: string;
          observer_name?: string | null;
          organization_id?: string;
          preliminary_conclusion?: string | null;
          primary_concern?: string | null;
          primary_operational_question?: string | null;
          problem_area?: string | null;
          problem_cell?: string | null;
          problem_department?: string | null;
          problem_machine?: string | null;
          problem_process?: string | null;
          problem_statement?: string | null;
          problem_timing?: string | null;
          rec_deeper_helps?: boolean | null;
          rec_in_scope?: boolean | null;
          rec_measurable_impact?: boolean | null;
          rec_significant_constraints?: boolean | null;
          rec_unvalidated?: boolean | null;
          recommendation?: string | null;
          recommended_path?: string | null;
          review_attendees?: string | null;
          review_meeting_date?: string | null;
          review_notes?: string | null;
          shift?: string | null;
          start_date?: string | null;
          status?: string;
          summary_constraint?: string | null;
          summary_observed?: string | null;
          summary_opportunity?: string | null;
          summary_outcome?: string | null;
          summary_recommendation?: string | null;
          summary_why?: string | null;
          target_completion_date?: string | null;
          team_members?: string | null;
          updated_at?: string;
          work_center?: string | null;
          workstreams?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "field_assessments_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_assessments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      field_attachments: {
        Row: {
          area: string | null;
          caption: string | null;
          created_at: string;
          created_by: string | null;
          domain_code: string | null;
          field_assessment_id: string;
          file_name: string | null;
          gap_id: string | null;
          id: string;
          machine: string | null;
          observation_id: string | null;
          storage_path: string;
        };
        Insert: {
          area?: string | null;
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string | null;
          field_assessment_id: string;
          file_name?: string | null;
          gap_id?: string | null;
          id?: string;
          machine?: string | null;
          observation_id?: string | null;
          storage_path: string;
        };
        Update: {
          area?: string | null;
          caption?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string | null;
          field_assessment_id?: string;
          file_name?: string | null;
          gap_id?: string | null;
          id?: string;
          machine?: string | null;
          observation_id?: string | null;
          storage_path?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_attachments_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_attachments_gap_id_fkey";
            columns: ["gap_id"];
            isOneToOne: false;
            referencedRelation: "field_gaps";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_attachments_observation_id_fkey";
            columns: ["observation_id"];
            isOneToOne: false;
            referencedRelation: "field_capture_observations";
            referencedColumns: ["id"];
          },
        ];
      };
      field_baseline_metrics: {
        Row: {
          confidence: string;
          created_at: string;
          created_by: string | null;
          data_class: string;
          evidence_note: string | null;
          field_assessment_id: string;
          id: string;
          measurement_period: string | null;
          metric_code: string | null;
          metric_name: string;
          sort_order: number;
          source: string | null;
          unit: string | null;
          updated_at: string;
          value: number | null;
        };
        Insert: {
          confidence?: string;
          created_at?: string;
          created_by?: string | null;
          data_class?: string;
          evidence_note?: string | null;
          field_assessment_id: string;
          id?: string;
          measurement_period?: string | null;
          metric_code?: string | null;
          metric_name: string;
          sort_order?: number;
          source?: string | null;
          unit?: string | null;
          updated_at?: string;
          value?: number | null;
        };
        Update: {
          confidence?: string;
          created_at?: string;
          created_by?: string | null;
          data_class?: string;
          evidence_note?: string | null;
          field_assessment_id?: string;
          id?: string;
          measurement_period?: string | null;
          metric_code?: string | null;
          metric_name?: string;
          sort_order?: number;
          source?: string | null;
          unit?: string | null;
          updated_at?: string;
          value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_baseline_metrics_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_capture_observations: {
        Row: {
          area: string | null;
          assessor_notes: string | null;
          category: string | null;
          constrained_capability: string | null;
          context_source: string | null;
          created_at: string;
          created_by: string | null;
          domain_code: string;
          evidence_class: string;
          field_assessment_id: string;
          focus_area: string | null;
          id: string;
          ironclad_support: string | null;
          machine: string | null;
          not_observed: boolean;
          objective_evidence: string | null;
          observed_condition: string | null;
          operational_impact: string | null;
          process: string | null;
          production_cell: string | null;
          rating: number | null;
          requires_validation: boolean;
          severity: string | null;
          updated_at: string;
        };
        Insert: {
          area?: string | null;
          assessor_notes?: string | null;
          category?: string | null;
          constrained_capability?: string | null;
          context_source?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code: string;
          evidence_class?: string;
          field_assessment_id: string;
          focus_area?: string | null;
          id?: string;
          ironclad_support?: string | null;
          machine?: string | null;
          not_observed?: boolean;
          objective_evidence?: string | null;
          observed_condition?: string | null;
          operational_impact?: string | null;
          process?: string | null;
          production_cell?: string | null;
          rating?: number | null;
          requires_validation?: boolean;
          severity?: string | null;
          updated_at?: string;
        };
        Update: {
          area?: string | null;
          assessor_notes?: string | null;
          category?: string | null;
          constrained_capability?: string | null;
          context_source?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string;
          evidence_class?: string;
          field_assessment_id?: string;
          focus_area?: string | null;
          id?: string;
          ironclad_support?: string | null;
          machine?: string | null;
          not_observed?: boolean;
          objective_evidence?: string | null;
          observed_condition?: string | null;
          operational_impact?: string | null;
          process?: string | null;
          production_cell?: string | null;
          rating?: number | null;
          requires_validation?: boolean;
          severity?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_capture_observations_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_cause_nodes: {
        Row: {
          chain_key: string;
          confidence: string;
          created_at: string;
          created_by: string | null;
          delay_id: string | null;
          description: string | null;
          domain_codes: string[];
          event_id: string | null;
          field_assessment_id: string;
          id: string;
          is_dominant: boolean;
          level: string;
          sort_order: number;
          updated_at: string;
          validation_status: string;
        };
        Insert: {
          chain_key?: string;
          confidence?: string;
          created_at?: string;
          created_by?: string | null;
          delay_id?: string | null;
          description?: string | null;
          domain_codes?: string[];
          event_id?: string | null;
          field_assessment_id: string;
          id?: string;
          is_dominant?: boolean;
          level: string;
          sort_order?: number;
          updated_at?: string;
          validation_status?: string;
        };
        Update: {
          chain_key?: string;
          confidence?: string;
          created_at?: string;
          created_by?: string | null;
          delay_id?: string | null;
          description?: string | null;
          domain_codes?: string[];
          event_id?: string | null;
          field_assessment_id?: string;
          id?: string;
          is_dominant?: boolean;
          level?: string;
          sort_order?: number;
          updated_at?: string;
          validation_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_cause_nodes_delay_id_fkey";
            columns: ["delay_id"];
            isOneToOne: false;
            referencedRelation: "field_delays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_cause_nodes_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "field_production_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_cause_nodes_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_constraints: {
        Row: {
          capability_gap: string | null;
          created_at: string;
          evidence: string | null;
          field_assessment_id: string;
          id: string;
          ironclad_response: string | null;
          production_impact: string | null;
          rank: number;
          updated_at: string;
        };
        Insert: {
          capability_gap?: string | null;
          created_at?: string;
          evidence?: string | null;
          field_assessment_id: string;
          id?: string;
          ironclad_response?: string | null;
          production_impact?: string | null;
          rank?: number;
          updated_at?: string;
        };
        Update: {
          capability_gap?: string | null;
          created_at?: string;
          evidence?: string | null;
          field_assessment_id?: string;
          id?: string;
          ironclad_response?: string | null;
          production_impact?: string | null;
          rank?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_constraints_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_delays: {
        Row: {
          created_at: string;
          created_by: string | null;
          ended_at: string | null;
          event_id: string | null;
          field_assessment_id: string;
          id: string;
          loss_category: string;
          machine: string | null;
          minutes_lost: number | null;
          part: string | null;
          person_involved: string | null;
          started_at: string | null;
          updated_at: string;
          what_happened: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          ended_at?: string | null;
          event_id?: string | null;
          field_assessment_id: string;
          id?: string;
          loss_category?: string;
          machine?: string | null;
          minutes_lost?: number | null;
          part?: string | null;
          person_involved?: string | null;
          started_at?: string | null;
          updated_at?: string;
          what_happened?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          ended_at?: string | null;
          event_id?: string | null;
          field_assessment_id?: string;
          id?: string;
          loss_category?: string;
          machine?: string | null;
          minutes_lost?: number | null;
          part?: string | null;
          person_involved?: string | null;
          started_at?: string | null;
          updated_at?: string;
          what_happened?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_delays_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "field_production_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_delays_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_event_marks: {
        Row: {
          created_at: string;
          created_by: string | null;
          edit_history: Json;
          event_id: string;
          id: string;
          mark_code: string;
          marked_at: string;
          note: string | null;
          original_at: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          edit_history?: Json;
          event_id: string;
          id?: string;
          mark_code: string;
          marked_at?: string;
          note?: string | null;
          original_at?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          edit_history?: Json;
          event_id?: string;
          id?: string;
          mark_code?: string;
          marked_at?: string;
          note?: string | null;
          original_at?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_event_marks_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "field_production_events";
            referencedColumns: ["id"];
          },
        ];
      };
      field_evidence_items: {
        Row: {
          captured_at: string;
          captured_by: string | null;
          cause_id: string | null;
          created_at: string;
          created_by: string | null;
          delay_id: string | null;
          description: string | null;
          event_id: string | null;
          evidence_type: string;
          field_assessment_id: string;
          file_name: string | null;
          gap_id: string | null;
          id: string;
          machine: string | null;
          observation_id: string | null;
          part: string | null;
          storage_path: string | null;
          updated_at: string;
        };
        Insert: {
          captured_at?: string;
          captured_by?: string | null;
          cause_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          delay_id?: string | null;
          description?: string | null;
          event_id?: string | null;
          evidence_type?: string;
          field_assessment_id: string;
          file_name?: string | null;
          gap_id?: string | null;
          id?: string;
          machine?: string | null;
          observation_id?: string | null;
          part?: string | null;
          storage_path?: string | null;
          updated_at?: string;
        };
        Update: {
          captured_at?: string;
          captured_by?: string | null;
          cause_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          delay_id?: string | null;
          description?: string | null;
          event_id?: string | null;
          evidence_type?: string;
          field_assessment_id?: string;
          file_name?: string | null;
          gap_id?: string | null;
          id?: string;
          machine?: string | null;
          observation_id?: string | null;
          part?: string | null;
          storage_path?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_evidence_items_cause_id_fkey";
            columns: ["cause_id"];
            isOneToOne: false;
            referencedRelation: "field_cause_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_evidence_items_delay_id_fkey";
            columns: ["delay_id"];
            isOneToOne: false;
            referencedRelation: "field_delays";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_evidence_items_event_id_fkey";
            columns: ["event_id"];
            isOneToOne: false;
            referencedRelation: "field_production_events";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_evidence_items_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_gaps: {
        Row: {
          capability_needed: string | null;
          category: string | null;
          client_comments: string | null;
          client_status: string | null;
          confidence: string | null;
          created_at: string;
          current_state: string | null;
          data_requirements: string[];
          domain_code: string | null;
          evidence_class: string | null;
          expected_result: string | null;
          field_assessment_id: string;
          field_rating: number | null;
          finding_rank: number | null;
          focus_area: string | null;
          frequency: string | null;
          gap_number: number | null;
          id: string;
          impact_tags: string[];
          implementation_effort: string | null;
          ironclad_action: string | null;
          ironclad_actions: string[];
          ironclad_fit: string | null;
          ironclad_support: string | null;
          is_top_finding: boolean;
          location: string | null;
          missing_capability: string | null;
          objective_evidence: string | null;
          observation_id: string | null;
          observed_condition: string | null;
          operational_impact: string | null;
          operational_impact_text: string | null;
          opp_complexity: string | null;
          opp_confidence: string | null;
          opp_next_action: string | null;
          opp_partner: string | null;
          opp_resources: string | null;
          opp_revenue: string | null;
          opp_scope: string | null;
          opp_service: string | null;
          opp_stage: string | null;
          preliminary_constraint: string | null;
          priority_class: string | null;
          priority_code: string | null;
          root_capability: string | null;
          severity: string | null;
          sort_order: number;
          title: string | null;
          updated_at: string;
          urgency: string | null;
          validation_needed: string | null;
          validation_questions: string[];
        };
        Insert: {
          capability_needed?: string | null;
          category?: string | null;
          client_comments?: string | null;
          client_status?: string | null;
          confidence?: string | null;
          created_at?: string;
          current_state?: string | null;
          data_requirements?: string[];
          domain_code?: string | null;
          evidence_class?: string | null;
          expected_result?: string | null;
          field_assessment_id: string;
          field_rating?: number | null;
          finding_rank?: number | null;
          focus_area?: string | null;
          frequency?: string | null;
          gap_number?: number | null;
          id?: string;
          impact_tags?: string[];
          implementation_effort?: string | null;
          ironclad_action?: string | null;
          ironclad_actions?: string[];
          ironclad_fit?: string | null;
          ironclad_support?: string | null;
          is_top_finding?: boolean;
          location?: string | null;
          missing_capability?: string | null;
          objective_evidence?: string | null;
          observation_id?: string | null;
          observed_condition?: string | null;
          operational_impact?: string | null;
          operational_impact_text?: string | null;
          opp_complexity?: string | null;
          opp_confidence?: string | null;
          opp_next_action?: string | null;
          opp_partner?: string | null;
          opp_resources?: string | null;
          opp_revenue?: string | null;
          opp_scope?: string | null;
          opp_service?: string | null;
          opp_stage?: string | null;
          preliminary_constraint?: string | null;
          priority_class?: string | null;
          priority_code?: string | null;
          root_capability?: string | null;
          severity?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          urgency?: string | null;
          validation_needed?: string | null;
          validation_questions?: string[];
        };
        Update: {
          capability_needed?: string | null;
          category?: string | null;
          client_comments?: string | null;
          client_status?: string | null;
          confidence?: string | null;
          created_at?: string;
          current_state?: string | null;
          data_requirements?: string[];
          domain_code?: string | null;
          evidence_class?: string | null;
          expected_result?: string | null;
          field_assessment_id?: string;
          field_rating?: number | null;
          finding_rank?: number | null;
          focus_area?: string | null;
          frequency?: string | null;
          gap_number?: number | null;
          id?: string;
          impact_tags?: string[];
          implementation_effort?: string | null;
          ironclad_action?: string | null;
          ironclad_actions?: string[];
          ironclad_fit?: string | null;
          ironclad_support?: string | null;
          is_top_finding?: boolean;
          location?: string | null;
          missing_capability?: string | null;
          objective_evidence?: string | null;
          observation_id?: string | null;
          observed_condition?: string | null;
          operational_impact?: string | null;
          operational_impact_text?: string | null;
          opp_complexity?: string | null;
          opp_confidence?: string | null;
          opp_next_action?: string | null;
          opp_partner?: string | null;
          opp_resources?: string | null;
          opp_revenue?: string | null;
          opp_scope?: string | null;
          opp_service?: string | null;
          opp_stage?: string | null;
          preliminary_constraint?: string | null;
          priority_class?: string | null;
          priority_code?: string | null;
          root_capability?: string | null;
          severity?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          urgency?: string | null;
          validation_needed?: string | null;
          validation_questions?: string[];
        };
        Relationships: [
          {
            foreignKeyName: "field_gaps_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_gaps_observation_id_fkey";
            columns: ["observation_id"];
            isOneToOne: false;
            referencedRelation: "field_capture_observations";
            referencedColumns: ["id"];
          },
        ];
      };
      field_observations: {
        Row: {
          area_code: string;
          created_at: string;
          field_assessment_id: string;
          id: string;
          not_observed: boolean;
          notes: string | null;
          rating: number | null;
          section_code: string;
          updated_at: string;
        };
        Insert: {
          area_code: string;
          created_at?: string;
          field_assessment_id: string;
          id?: string;
          not_observed?: boolean;
          notes?: string | null;
          rating?: number | null;
          section_code: string;
          updated_at?: string;
        };
        Update: {
          area_code?: string;
          created_at?: string;
          field_assessment_id?: string;
          id?: string;
          not_observed?: boolean;
          notes?: string | null;
          rating?: number | null;
          section_code?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_observations_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_opportunities: {
        Row: {
          affected_machines: string | null;
          affected_parts: string | null;
          capability_gap: string | null;
          complexity: string | null;
          created_at: string;
          created_by: string | null;
          domain_code: string | null;
          effort: string | null;
          expected_impact: string | null;
          field_assessment_id: string;
          gap_id: string | null;
          id: string;
          impact: string | null;
          is_pilot_candidate: boolean;
          opportunity: string | null;
          phase: string | null;
          priority: string | null;
          problem: string | null;
          recommended_action: string | null;
          sort_order: number;
          title: string | null;
          updated_at: string;
          workflow_status: string | null;
        };
        Insert: {
          affected_machines?: string | null;
          affected_parts?: string | null;
          capability_gap?: string | null;
          complexity?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string | null;
          effort?: string | null;
          expected_impact?: string | null;
          field_assessment_id: string;
          gap_id?: string | null;
          id?: string;
          impact?: string | null;
          is_pilot_candidate?: boolean;
          opportunity?: string | null;
          phase?: string | null;
          priority?: string | null;
          problem?: string | null;
          recommended_action?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          workflow_status?: string | null;
        };
        Update: {
          affected_machines?: string | null;
          affected_parts?: string | null;
          capability_gap?: string | null;
          complexity?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string | null;
          effort?: string | null;
          expected_impact?: string | null;
          field_assessment_id?: string;
          gap_id?: string | null;
          id?: string;
          impact?: string | null;
          is_pilot_candidate?: boolean;
          opportunity?: string | null;
          phase?: string | null;
          priority?: string | null;
          problem?: string | null;
          recommended_action?: string | null;
          sort_order?: number;
          title?: string | null;
          updated_at?: string;
          workflow_status?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_opportunities_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_pilot_metrics: {
        Row: {
          after_value: number | null;
          baseline_metric_id: string | null;
          before_value: number | null;
          created_at: string;
          data_class: string;
          id: string;
          measured_at: string | null;
          metric_name: string;
          note: string | null;
          pilot_id: string;
          sort_order: number;
          unit: string | null;
          updated_at: string;
        };
        Insert: {
          after_value?: number | null;
          baseline_metric_id?: string | null;
          before_value?: number | null;
          created_at?: string;
          data_class?: string;
          id?: string;
          measured_at?: string | null;
          metric_name: string;
          note?: string | null;
          pilot_id: string;
          sort_order?: number;
          unit?: string | null;
          updated_at?: string;
        };
        Update: {
          after_value?: number | null;
          baseline_metric_id?: string | null;
          before_value?: number | null;
          created_at?: string;
          data_class?: string;
          id?: string;
          measured_at?: string | null;
          metric_name?: string;
          note?: string | null;
          pilot_id?: string;
          sort_order?: number;
          unit?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_pilot_metrics_baseline_metric_id_fkey";
            columns: ["baseline_metric_id"];
            isOneToOne: false;
            referencedRelation: "field_baseline_metrics";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_pilot_metrics_pilot_id_fkey";
            columns: ["pilot_id"];
            isOneToOne: false;
            referencedRelation: "field_pilots";
            referencedColumns: ["id"];
          },
        ];
      };
      field_pilots: {
        Row: {
          affected_metric: string | null;
          approval_status: string;
          created_at: string;
          created_by: string | null;
          current_condition: string | null;
          deliverables: string | null;
          estimated_price: number | null;
          exclusions: string | null;
          field_assessment_id: string;
          financial_class: string;
          hours_recovered_week: number | null;
          id: string;
          implementation_notes: string | null;
          implementation_status: string;
          is_recommended: boolean;
          iss_implementation_cost: number | null;
          labor_rate: number | null;
          machine_burden_rate: number | null;
          opportunity_id: string | null;
          other_cost_basis: number | null;
          overtime_cost: number | null;
          production_value_hour: number | null;
          proposed_change: string | null;
          scope_capability_gap: string | null;
          scope_exceptions: string | null;
          scope_fixture: string | null;
          scope_machine: string | null;
          scope_outcome: string | null;
          scope_part: string | null;
          score_controllability: number | null;
          score_evidence_strength: number | null;
          score_feasibility: number | null;
          score_frequency: number | null;
          score_measurability: number | null;
          score_production_impact: number | null;
          score_replication: number | null;
          scrap_cost: number | null;
          target_completion: string | null;
          title: string | null;
          updated_at: string;
          validated_gap: string | null;
          validation_method: string | null;
        };
        Insert: {
          affected_metric?: string | null;
          approval_status?: string;
          created_at?: string;
          created_by?: string | null;
          current_condition?: string | null;
          deliverables?: string | null;
          estimated_price?: number | null;
          exclusions?: string | null;
          field_assessment_id: string;
          financial_class?: string;
          hours_recovered_week?: number | null;
          id?: string;
          implementation_notes?: string | null;
          implementation_status?: string;
          is_recommended?: boolean;
          iss_implementation_cost?: number | null;
          labor_rate?: number | null;
          machine_burden_rate?: number | null;
          opportunity_id?: string | null;
          other_cost_basis?: number | null;
          overtime_cost?: number | null;
          production_value_hour?: number | null;
          proposed_change?: string | null;
          scope_capability_gap?: string | null;
          scope_exceptions?: string | null;
          scope_fixture?: string | null;
          scope_machine?: string | null;
          scope_outcome?: string | null;
          scope_part?: string | null;
          score_controllability?: number | null;
          score_evidence_strength?: number | null;
          score_feasibility?: number | null;
          score_frequency?: number | null;
          score_measurability?: number | null;
          score_production_impact?: number | null;
          score_replication?: number | null;
          scrap_cost?: number | null;
          target_completion?: string | null;
          title?: string | null;
          updated_at?: string;
          validated_gap?: string | null;
          validation_method?: string | null;
        };
        Update: {
          affected_metric?: string | null;
          approval_status?: string;
          created_at?: string;
          created_by?: string | null;
          current_condition?: string | null;
          deliverables?: string | null;
          estimated_price?: number | null;
          exclusions?: string | null;
          field_assessment_id?: string;
          financial_class?: string;
          hours_recovered_week?: number | null;
          id?: string;
          implementation_notes?: string | null;
          implementation_status?: string;
          is_recommended?: boolean;
          iss_implementation_cost?: number | null;
          labor_rate?: number | null;
          machine_burden_rate?: number | null;
          opportunity_id?: string | null;
          other_cost_basis?: number | null;
          overtime_cost?: number | null;
          production_value_hour?: number | null;
          proposed_change?: string | null;
          scope_capability_gap?: string | null;
          scope_exceptions?: string | null;
          scope_fixture?: string | null;
          scope_machine?: string | null;
          scope_outcome?: string | null;
          scope_part?: string | null;
          score_controllability?: number | null;
          score_evidence_strength?: number | null;
          score_feasibility?: number | null;
          score_frequency?: number | null;
          score_measurability?: number | null;
          score_production_impact?: number | null;
          score_replication?: number | null;
          scrap_cost?: number | null;
          target_completion?: string | null;
          title?: string | null;
          updated_at?: string;
          validated_gap?: string | null;
          validation_method?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_pilots_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_pilots_opportunity_id_fkey";
            columns: ["opportunity_id"];
            isOneToOne: false;
            referencedRelation: "field_opportunities";
            referencedColumns: ["id"];
          },
        ];
      };
      field_production_events: {
        Row: {
          created_at: string;
          created_by: string | null;
          event_type: string;
          field_assessment_id: string;
          fixture: string | null;
          id: string;
          incoming_job: string | null;
          machine: string | null;
          material: string | null;
          notes: string | null;
          occurred_at: string;
          operator: string | null;
          part: string | null;
          previous_job: string | null;
          program: string | null;
          shift: string | null;
          status: string;
          timer_started_at: string | null;
          tooling_package: string | null;
          troubleshooting_resolution: string | null;
          troubleshooting_started_at: string | null;
          updated_at: string;
          work_order: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          event_type?: string;
          field_assessment_id: string;
          fixture?: string | null;
          id?: string;
          incoming_job?: string | null;
          machine?: string | null;
          material?: string | null;
          notes?: string | null;
          occurred_at?: string;
          operator?: string | null;
          part?: string | null;
          previous_job?: string | null;
          program?: string | null;
          shift?: string | null;
          status?: string;
          timer_started_at?: string | null;
          tooling_package?: string | null;
          troubleshooting_resolution?: string | null;
          troubleshooting_started_at?: string | null;
          updated_at?: string;
          work_order?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          event_type?: string;
          field_assessment_id?: string;
          fixture?: string | null;
          id?: string;
          incoming_job?: string | null;
          machine?: string | null;
          material?: string | null;
          notes?: string | null;
          occurred_at?: string;
          operator?: string | null;
          part?: string | null;
          previous_job?: string | null;
          program?: string | null;
          shift?: string | null;
          status?: string;
          timer_started_at?: string | null;
          tooling_package?: string | null;
          troubleshooting_resolution?: string | null;
          troubleshooting_started_at?: string | null;
          updated_at?: string;
          work_order?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_production_events_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_quick_captures: {
        Row: {
          area: string | null;
          converted_observation_id: string | null;
          created_at: string;
          created_by: string | null;
          domain_code: string | null;
          field_assessment_id: string;
          id: string;
          machine: string | null;
          note: string | null;
          potential_problem: string | null;
          updated_at: string;
        };
        Insert: {
          area?: string | null;
          converted_observation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string | null;
          field_assessment_id: string;
          id?: string;
          machine?: string | null;
          note?: string | null;
          potential_problem?: string | null;
          updated_at?: string;
        };
        Update: {
          area?: string | null;
          converted_observation_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          domain_code?: string | null;
          field_assessment_id?: string;
          id?: string;
          machine?: string | null;
          note?: string | null;
          potential_problem?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_quick_captures_converted_observation_id_fkey";
            columns: ["converted_observation_id"];
            isOneToOne: false;
            referencedRelation: "field_capture_observations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "field_quick_captures_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      field_sme_dependencies: {
        Row: {
          assistance_frequency: string | null;
          common_adjustments: string | null;
          created_at: string;
          created_by: string | null;
          decisions_made: string | null;
          does_differently: string | null;
          field_assessment_id: string;
          id: string;
          impact_when_absent: string | null;
          method_comparison: Json;
          scope: string | null;
          sme_name: string | null;
          undocumented_knowledge: string | null;
          updated_at: string;
        };
        Insert: {
          assistance_frequency?: string | null;
          common_adjustments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decisions_made?: string | null;
          does_differently?: string | null;
          field_assessment_id: string;
          id?: string;
          impact_when_absent?: string | null;
          method_comparison?: Json;
          scope?: string | null;
          sme_name?: string | null;
          undocumented_knowledge?: string | null;
          updated_at?: string;
        };
        Update: {
          assistance_frequency?: string | null;
          common_adjustments?: string | null;
          created_at?: string;
          created_by?: string | null;
          decisions_made?: string | null;
          does_differently?: string | null;
          field_assessment_id?: string;
          id?: string;
          impact_when_absent?: string | null;
          method_comparison?: Json;
          scope?: string | null;
          sme_name?: string | null;
          undocumented_knowledge?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "field_sme_dependencies_field_assessment_id_fkey";
            columns: ["field_assessment_id"];
            isOneToOne: false;
            referencedRelation: "field_assessments";
            referencedColumns: ["id"];
          },
        ];
      };
      findings: {
        Row: {
          archived: boolean;
          assessment_id: string | null;
          assigned_owner: string | null;
          business_impact: string | null;
          category_name: string | null;
          closure_evidence: string | null;
          created_at: string;
          created_by: string | null;
          description: string;
          facility_id: string;
          finding_code: string | null;
          id: string;
          organization_id: string;
          question_id: string | null;
          recommended_action: string | null;
          root_cause: string | null;
          severity: Database["public"]["Enums"]["finding_severity"];
          status: Database["public"]["Enums"]["finding_status"];
          target_date: string | null;
          updated_at: string;
          updated_by: string | null;
          verification_date: string | null;
          verified_by: string | null;
        };
        Insert: {
          archived?: boolean;
          assessment_id?: string | null;
          assigned_owner?: string | null;
          business_impact?: string | null;
          category_name?: string | null;
          closure_evidence?: string | null;
          created_at?: string;
          created_by?: string | null;
          description: string;
          facility_id: string;
          finding_code?: string | null;
          id?: string;
          organization_id: string;
          question_id?: string | null;
          recommended_action?: string | null;
          root_cause?: string | null;
          severity?: Database["public"]["Enums"]["finding_severity"];
          status?: Database["public"]["Enums"]["finding_status"];
          target_date?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_date?: string | null;
          verified_by?: string | null;
        };
        Update: {
          archived?: boolean;
          assessment_id?: string | null;
          assigned_owner?: string | null;
          business_impact?: string | null;
          category_name?: string | null;
          closure_evidence?: string | null;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          facility_id?: string;
          finding_code?: string | null;
          id?: string;
          organization_id?: string;
          question_id?: string | null;
          recommended_action?: string | null;
          root_cause?: string | null;
          severity?: Database["public"]["Enums"]["finding_severity"];
          status?: Database["public"]["Enums"]["finding_status"];
          target_date?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          verification_date?: string | null;
          verified_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "findings_assessment_id_fkey";
            columns: ["assessment_id"];
            isOneToOne: false;
            referencedRelation: "assessments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "findings_question_id_fkey";
            columns: ["question_id"];
            isOneToOne: false;
            referencedRelation: "assessment_questions";
            referencedColumns: ["id"];
          },
        ];
      };
      geometry_analysis_runs: {
        Row: {
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          manual_review_required: boolean;
          organization_id: string;
          provider: string;
          provider_version: string;
          requested_at: string;
          result: Json | null;
          rfq_file_id: string | null;
          rfq_part_id: string;
          status: string;
          uncertainty: number | null;
          updated_at: string;
          warnings: Json;
        };
        Insert: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          manual_review_required?: boolean;
          organization_id: string;
          provider?: string;
          provider_version?: string;
          requested_at?: string;
          result?: Json | null;
          rfq_file_id?: string | null;
          rfq_part_id: string;
          status?: string;
          uncertainty?: number | null;
          updated_at?: string;
          warnings?: Json;
        };
        Update: {
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          manual_review_required?: boolean;
          organization_id?: string;
          provider?: string;
          provider_version?: string;
          requested_at?: string;
          result?: Json | null;
          rfq_file_id?: string | null;
          rfq_part_id?: string;
          status?: string;
          uncertainty?: number | null;
          updated_at?: string;
          warnings?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "geometry_analysis_runs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "geometry_analysis_runs_rfq_file_id_fkey";
            columns: ["rfq_file_id"];
            isOneToOne: false;
            referencedRelation: "rfq_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "geometry_analysis_runs_rfq_part_id_fkey";
            columns: ["rfq_part_id"];
            isOneToOne: false;
            referencedRelation: "rfq_parts";
            referencedColumns: ["id"];
          },
        ];
      };
      historical_jobs: {
        Row: {
          completed_on: string | null;
          complexity_score: number | null;
          created_at: string;
          created_by: string | null;
          facility_id: string | null;
          id: string;
          machine_id: string | null;
          material_id: string | null;
          organization_id: string;
          part_number: string;
          programmer_id: string | null;
          quote_id: string | null;
          revision: string | null;
          rfq_id: string | null;
          updated_at: string;
          work_order_id: string | null;
        };
        Insert: {
          completed_on?: string | null;
          complexity_score?: number | null;
          created_at?: string;
          created_by?: string | null;
          facility_id?: string | null;
          id?: string;
          machine_id?: string | null;
          material_id?: string | null;
          organization_id: string;
          part_number: string;
          programmer_id?: string | null;
          quote_id?: string | null;
          revision?: string | null;
          rfq_id?: string | null;
          updated_at?: string;
          work_order_id?: string | null;
        };
        Update: {
          completed_on?: string | null;
          complexity_score?: number | null;
          created_at?: string;
          created_by?: string | null;
          facility_id?: string | null;
          id?: string;
          machine_id?: string | null;
          material_id?: string | null;
          organization_id?: string;
          part_number?: string;
          programmer_id?: string | null;
          quote_id?: string | null;
          revision?: string | null;
          rfq_id?: string | null;
          updated_at?: string;
          work_order_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "historical_jobs_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_jobs_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_jobs_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_jobs_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_jobs_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "historical_jobs_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "programming_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      improvement_projects: {
        Row: {
          actions: string | null;
          archived: boolean;
          baseline_metric: string | null;
          created_at: string;
          created_by: string | null;
          estimated_financial_impact: number | null;
          executive_sponsor: string | null;
          facility_id: string;
          id: string;
          name: string;
          objective: string | null;
          organization_id: string;
          owner: string | null;
          percent_complete: number;
          planned_completion: string | null;
          planned_start: string | null;
          results: string | null;
          risks: string | null;
          status: Database["public"]["Enums"]["project_status"];
          target_metric: string | null;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          actions?: string | null;
          archived?: boolean;
          baseline_metric?: string | null;
          created_at?: string;
          created_by?: string | null;
          estimated_financial_impact?: number | null;
          executive_sponsor?: string | null;
          facility_id: string;
          id?: string;
          name: string;
          objective?: string | null;
          organization_id: string;
          owner?: string | null;
          percent_complete?: number;
          planned_completion?: string | null;
          planned_start?: string | null;
          results?: string | null;
          risks?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          target_metric?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          actions?: string | null;
          archived?: boolean;
          baseline_metric?: string | null;
          created_at?: string;
          created_by?: string | null;
          estimated_financial_impact?: number | null;
          executive_sponsor?: string | null;
          facility_id?: string;
          id?: string;
          name?: string;
          objective?: string | null;
          organization_id?: string;
          owner?: string | null;
          percent_complete?: number;
          planned_completion?: string | null;
          planned_start?: string | null;
          results?: string | null;
          risks?: string | null;
          status?: Database["public"]["Enums"]["project_status"];
          target_metric?: string | null;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "improvement_projects_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "improvement_projects_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_exceptions: {
        Row: {
          created_at: string;
          decided_at: string | null;
          decided_by: string | null;
          decided_by_name: string | null;
          decision_reason: string | null;
          id: string;
          job_id: string;
          kind: Database["public"]["Enums"]["exception_kind"];
          missing_items: string | null;
          proposed_path: string | null;
          request_reason: string;
          requested_by: string | null;
          requested_by_name: string | null;
          resume_status: Database["public"]["Enums"]["job_status"] | null;
          status: Database["public"]["Enums"]["exception_status"];
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decided_by_name?: string | null;
          decision_reason?: string | null;
          id?: string;
          job_id: string;
          kind: Database["public"]["Enums"]["exception_kind"];
          missing_items?: string | null;
          proposed_path?: string | null;
          request_reason: string;
          requested_by?: string | null;
          requested_by_name?: string | null;
          resume_status?: Database["public"]["Enums"]["job_status"] | null;
          status?: Database["public"]["Enums"]["exception_status"];
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          decided_at?: string | null;
          decided_by?: string | null;
          decided_by_name?: string | null;
          decision_reason?: string | null;
          id?: string;
          job_id?: string;
          kind?: Database["public"]["Enums"]["exception_kind"];
          missing_items?: string | null;
          proposed_path?: string | null;
          request_reason?: string;
          requested_by?: string | null;
          requested_by_name?: string | null;
          resume_status?: Database["public"]["Enums"]["job_status"] | null;
          status?: Database["public"]["Enums"]["exception_status"];
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_exceptions_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      intake_reviews: {
        Row: {
          ai_suitable: boolean;
          checklist: Json;
          complexity: Database["public"]["Enums"]["complexity_level"] | null;
          created_at: string;
          data_package: Json;
          flags: string[];
          id: string;
          job_id: string;
          notes: string | null;
          result: Database["public"]["Enums"]["intake_result"] | null;
          reviewed_by: string | null;
          updated_at: string;
        };
        Insert: {
          ai_suitable?: boolean;
          checklist?: Json;
          complexity?: Database["public"]["Enums"]["complexity_level"] | null;
          created_at?: string;
          data_package?: Json;
          flags?: string[];
          id?: string;
          job_id: string;
          notes?: string | null;
          result?: Database["public"]["Enums"]["intake_result"] | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Update: {
          ai_suitable?: boolean;
          checklist?: Json;
          complexity?: Database["public"]["Enums"]["complexity_level"] | null;
          created_at?: string;
          data_package?: Json;
          flags?: string[];
          id?: string;
          job_id?: string;
          notes?: string | null;
          result?: Database["public"]["Enums"]["intake_result"] | null;
          reviewed_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "intake_reviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      job_files: {
        Row: {
          created_at: string;
          file_kind: string;
          file_name: string;
          file_size: number | null;
          id: string;
          job_id: string;
          notes: string | null;
          storage_path: string;
          uploaded_by: string;
        };
        Insert: {
          created_at?: string;
          file_kind?: string;
          file_name: string;
          file_size?: number | null;
          id?: string;
          job_id: string;
          notes?: string | null;
          storage_path: string;
          uploaded_by?: string;
        };
        Update: {
          created_at?: string;
          file_kind?: string;
          file_name?: string;
          file_size?: number | null;
          id?: string;
          job_id?: string;
          notes?: string | null;
          storage_path?: string;
          uploaded_by?: string;
        };
        Relationships: [
          {
            foreignKeyName: "job_files_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      jobs: {
        Row: {
          assigned_programmer: string | null;
          available_tooling: string | null;
          axis_count: number | null;
          controller: string | null;
          created_at: string;
          created_by: string;
          critical_dimensions: string | null;
          customer_job_number: string | null;
          exception_approved_by: string | null;
          exception_reason: string | null;
          facility_id: string | null;
          fixture_restrictions: string | null;
          geometric_tolerances: string | null;
          id: string;
          inspection_requirements: string | null;
          integration_mode:
            Database["public"]["Enums"]["integration_mode"] | null;
          job_number: string;
          machine_make: string | null;
          machine_model: string | null;
          machine_profile_id: string | null;
          material_spec: string | null;
          organization_id: string;
          part_name: string | null;
          part_number: string | null;
          part_revision: string | null;
          quantity: number | null;
          released_at: string | null;
          released_by: string | null;
          requested_turnaround: string | null;
          special_instructions: string | null;
          status: Database["public"]["Enums"]["job_status"];
          stock_diameter: number | null;
          stock_length: number | null;
          stock_thickness: number | null;
          stock_type: string | null;
          stock_width: number | null;
          submitted_at: string | null;
          surface_finish_requirements: string | null;
          updated_at: string;
          workholding_method: string | null;
        };
        Insert: {
          assigned_programmer?: string | null;
          available_tooling?: string | null;
          axis_count?: number | null;
          controller?: string | null;
          created_at?: string;
          created_by?: string;
          critical_dimensions?: string | null;
          customer_job_number?: string | null;
          exception_approved_by?: string | null;
          exception_reason?: string | null;
          facility_id?: string | null;
          fixture_restrictions?: string | null;
          geometric_tolerances?: string | null;
          id?: string;
          inspection_requirements?: string | null;
          integration_mode?:
            Database["public"]["Enums"]["integration_mode"] | null;
          job_number?: string;
          machine_make?: string | null;
          machine_model?: string | null;
          machine_profile_id?: string | null;
          material_spec?: string | null;
          organization_id: string;
          part_name?: string | null;
          part_number?: string | null;
          part_revision?: string | null;
          quantity?: number | null;
          released_at?: string | null;
          released_by?: string | null;
          requested_turnaround?: string | null;
          special_instructions?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          stock_diameter?: number | null;
          stock_length?: number | null;
          stock_thickness?: number | null;
          stock_type?: string | null;
          stock_width?: number | null;
          submitted_at?: string | null;
          surface_finish_requirements?: string | null;
          updated_at?: string;
          workholding_method?: string | null;
        };
        Update: {
          assigned_programmer?: string | null;
          available_tooling?: string | null;
          axis_count?: number | null;
          controller?: string | null;
          created_at?: string;
          created_by?: string;
          critical_dimensions?: string | null;
          customer_job_number?: string | null;
          exception_approved_by?: string | null;
          exception_reason?: string | null;
          facility_id?: string | null;
          fixture_restrictions?: string | null;
          geometric_tolerances?: string | null;
          id?: string;
          inspection_requirements?: string | null;
          integration_mode?:
            Database["public"]["Enums"]["integration_mode"] | null;
          job_number?: string;
          machine_make?: string | null;
          machine_model?: string | null;
          machine_profile_id?: string | null;
          material_spec?: string | null;
          organization_id?: string;
          part_name?: string | null;
          part_number?: string | null;
          part_revision?: string | null;
          quantity?: number | null;
          released_at?: string | null;
          released_by?: string | null;
          requested_turnaround?: string | null;
          special_instructions?: string | null;
          status?: Database["public"]["Enums"]["job_status"];
          stock_diameter?: number | null;
          stock_length?: number | null;
          stock_thickness?: number | null;
          stock_type?: string | null;
          stock_width?: number | null;
          submitted_at?: string | null;
          surface_finish_requirements?: string | null;
          updated_at?: string;
          workholding_method?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "jobs_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_machine_profile_id_fkey";
            columns: ["machine_profile_id"];
            isOneToOne: false;
            referencedRelation: "machine_profiles";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_capabilities: {
        Row: {
          capability_type: string;
          created_at: string;
          id: string;
          machine_id: string;
          value: string;
        };
        Insert: {
          capability_type: string;
          created_at?: string;
          id?: string;
          machine_id: string;
          value: string;
        };
        Update: {
          capability_type?: string;
          created_at?: string;
          id?: string;
          machine_id?: string;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "machine_capabilities_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_profiles: {
        Row: {
          axis_count: number;
          controller: string;
          created_at: string;
          id: string;
          is_supported: boolean;
          known_limitations: string | null;
          make: string;
          max_feed_rate: number | null;
          max_spindle_rpm: number | null;
          model: string;
          name: string;
          organization_id: string | null;
          post_processors: string[];
          rotary_limits: string | null;
          travel_x: number | null;
          travel_y: number | null;
          travel_z: number | null;
          updated_at: string;
        };
        Insert: {
          axis_count?: number;
          controller: string;
          created_at?: string;
          id?: string;
          is_supported?: boolean;
          known_limitations?: string | null;
          make: string;
          max_feed_rate?: number | null;
          max_spindle_rpm?: number | null;
          model: string;
          name: string;
          organization_id?: string | null;
          post_processors?: string[];
          rotary_limits?: string | null;
          travel_x?: number | null;
          travel_y?: number | null;
          travel_z?: number | null;
          updated_at?: string;
        };
        Update: {
          axis_count?: number;
          controller?: string;
          created_at?: string;
          id?: string;
          is_supported?: boolean;
          known_limitations?: string | null;
          make?: string;
          max_feed_rate?: number | null;
          max_spindle_rpm?: number | null;
          model?: string;
          name?: string;
          organization_id?: string | null;
          post_processors?: string[];
          rotary_limits?: string | null;
          travel_x?: number | null;
          travel_y?: number | null;
          travel_z?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "machine_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      machine_rates: {
        Row: {
          created_at: string;
          created_by: string | null;
          effective_date: string;
          hourly_burden_rate: number;
          id: string;
          machine_id: string;
          notes: string | null;
          programming_rate: number;
          setup_labor_rate: number;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          hourly_burden_rate: number;
          id?: string;
          machine_id: string;
          notes?: string | null;
          programming_rate?: number;
          setup_labor_rate: number;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          hourly_burden_rate?: number;
          id?: string;
          machine_id?: string;
          notes?: string | null;
          programming_rate?: number;
          setup_labor_rate?: number;
        };
        Relationships: [
          {
            foreignKeyName: "machine_rates_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
        ];
      };
      machines: {
        Row: {
          active: boolean;
          axis_count: number;
          created_at: string;
          created_by: string | null;
          envelope_x: number | null;
          envelope_y: number | null;
          envelope_z: number | null;
          facility_id: string | null;
          hourly_burden_rate: number;
          id: string;
          machine_definition: string | null;
          machine_type: Database["public"]["Enums"]["machine_type"];
          manufacturer: string;
          max_spindle_rpm: number | null;
          max_stock_x: number | null;
          max_stock_y: number | null;
          max_stock_z: number | null;
          model: string;
          organization_id: string | null;
          post_processor: string | null;
          setup_labor_rate: number;
          spindle_power_hp: number | null;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          axis_count?: number;
          created_at?: string;
          created_by?: string | null;
          envelope_x?: number | null;
          envelope_y?: number | null;
          envelope_z?: number | null;
          facility_id?: string | null;
          hourly_burden_rate?: number;
          id?: string;
          machine_definition?: string | null;
          machine_type: Database["public"]["Enums"]["machine_type"];
          manufacturer: string;
          max_spindle_rpm?: number | null;
          max_stock_x?: number | null;
          max_stock_y?: number | null;
          max_stock_z?: number | null;
          model: string;
          organization_id?: string | null;
          post_processor?: string | null;
          setup_labor_rate?: number;
          spindle_power_hp?: number | null;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          axis_count?: number;
          created_at?: string;
          created_by?: string | null;
          envelope_x?: number | null;
          envelope_y?: number | null;
          envelope_z?: number | null;
          facility_id?: string | null;
          hourly_burden_rate?: number;
          id?: string;
          machine_definition?: string | null;
          machine_type?: Database["public"]["Enums"]["machine_type"];
          manufacturer?: string;
          max_spindle_rpm?: number | null;
          max_stock_x?: number | null;
          max_stock_y?: number | null;
          max_stock_z?: number | null;
          model?: string;
          organization_id?: string | null;
          post_processor?: string | null;
          setup_labor_rate?: number;
          spindle_power_hp?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "machines_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "machines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      manufacturing_features: {
        Row: {
          count: number;
          created_at: string;
          detail: Json;
          feature_type: string;
          geometry_analysis_run_id: string;
          id: string;
        };
        Insert: {
          count?: number;
          created_at?: string;
          detail?: Json;
          feature_type: string;
          geometry_analysis_run_id: string;
          id?: string;
        };
        Update: {
          count?: number;
          created_at?: string;
          detail?: Json;
          feature_type?: string;
          geometry_analysis_run_id?: string;
          id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "manufacturing_features_geometry_analysis_run_id_fkey";
            columns: ["geometry_analysis_run_id"];
            isOneToOne: false;
            referencedRelation: "geometry_analysis_runs";
            referencedColumns: ["id"];
          },
        ];
      };
      mastercam_jobs: {
        Row: {
          created_at: string;
          file_name: string | null;
          file_version: string | null;
          id: string;
          job_id: string;
          last_sync_at: string | null;
          machine_definition: string | null;
          mastercam_version: string | null;
          mode: Database["public"]["Enums"]["integration_mode"];
          notes: string | null;
          package: Json;
          post_processor_id: string | null;
          state: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          file_name?: string | null;
          file_version?: string | null;
          id?: string;
          job_id: string;
          last_sync_at?: string | null;
          machine_definition?: string | null;
          mastercam_version?: string | null;
          mode?: Database["public"]["Enums"]["integration_mode"];
          notes?: string | null;
          package?: Json;
          post_processor_id?: string | null;
          state?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          file_name?: string | null;
          file_version?: string | null;
          id?: string;
          job_id?: string;
          last_sync_at?: string | null;
          machine_definition?: string | null;
          mastercam_version?: string | null;
          mode?: Database["public"]["Enums"]["integration_mode"];
          notes?: string | null;
          package?: Json;
          post_processor_id?: string | null;
          state?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "mastercam_jobs_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "mastercam_jobs_post_processor_id_fkey";
            columns: ["post_processor_id"];
            isOneToOne: false;
            referencedRelation: "post_processors";
            referencedColumns: ["id"];
          },
        ];
      };
      material_prices: {
        Row: {
          cost_per_pound: number;
          cost_per_stock_unit: number | null;
          created_at: string;
          created_by: string | null;
          effective_date: string;
          id: string;
          material_id: string;
          notes: string | null;
          supplier: string | null;
        };
        Insert: {
          cost_per_pound: number;
          cost_per_stock_unit?: number | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          id?: string;
          material_id: string;
          notes?: string | null;
          supplier?: string | null;
        };
        Update: {
          cost_per_pound?: number;
          cost_per_stock_unit?: number | null;
          created_at?: string;
          created_by?: string | null;
          effective_date?: string;
          id?: string;
          material_id?: string;
          notes?: string | null;
          supplier?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "material_prices_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      materials: {
        Row: {
          active: boolean;
          cost_per_pound: number;
          cost_per_stock_unit: number | null;
          created_at: string;
          created_by: string | null;
          cycle_time_factor: number;
          density_lb_in3: number;
          effective_date: string;
          family: string;
          form: string;
          grade: string;
          id: string;
          machinability_rating: number;
          organization_id: string | null;
          preferred_tooling_notes: string | null;
          programming_complexity_factor: number;
          specialty: boolean;
          supplier: string | null;
          tool_wear_factor: number;
          updated_at: string;
          waste_factor: number;
        };
        Insert: {
          active?: boolean;
          cost_per_pound?: number;
          cost_per_stock_unit?: number | null;
          created_at?: string;
          created_by?: string | null;
          cycle_time_factor?: number;
          density_lb_in3?: number;
          effective_date?: string;
          family: string;
          form: string;
          grade: string;
          id?: string;
          machinability_rating?: number;
          organization_id?: string | null;
          preferred_tooling_notes?: string | null;
          programming_complexity_factor?: number;
          specialty?: boolean;
          supplier?: string | null;
          tool_wear_factor?: number;
          updated_at?: string;
          waste_factor?: number;
        };
        Update: {
          active?: boolean;
          cost_per_pound?: number;
          cost_per_stock_unit?: number | null;
          created_at?: string;
          created_by?: string | null;
          cycle_time_factor?: number;
          density_lb_in3?: number;
          effective_date?: string;
          family?: string;
          form?: string;
          grade?: string;
          id?: string;
          machinability_rating?: number;
          organization_id?: string | null;
          preferred_tooling_notes?: string | null;
          programming_complexity_factor?: number;
          specialty?: boolean;
          supplier?: string | null;
          tool_wear_factor?: number;
          updated_at?: string;
          waste_factor?: number;
        };
        Relationships: [
          {
            foreignKeyName: "materials_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      nc_programs: {
        Row: {
          bucket: string;
          checksum: string | null;
          created_at: string;
          created_by: string | null;
          file_size: number;
          id: string;
          machine_id: string | null;
          organization_id: string;
          post_processor: string | null;
          program_name: string;
          released: boolean;
          released_at: string | null;
          released_by: string | null;
          revision: number;
          storage_path: string;
          updated_at: string;
          verified: boolean;
          work_order_id: string;
        };
        Insert: {
          bucket?: string;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_size?: number;
          id?: string;
          machine_id?: string | null;
          organization_id: string;
          post_processor?: string | null;
          program_name: string;
          released?: boolean;
          released_at?: string | null;
          released_by?: string | null;
          revision?: number;
          storage_path: string;
          updated_at?: string;
          verified?: boolean;
          work_order_id: string;
        };
        Update: {
          bucket?: string;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_size?: number;
          id?: string;
          machine_id?: string | null;
          organization_id?: string;
          post_processor?: string | null;
          program_name?: string;
          released?: boolean;
          released_at?: string | null;
          released_by?: string | null;
          revision?: number;
          storage_path?: string;
          updated_at?: string;
          verified?: boolean;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "nc_programs_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nc_programs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "nc_programs_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "programming_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      operations: {
        Row: {
          clearance: number | null;
          coolant: string | null;
          created_at: string;
          customer_requirement: string | null;
          description: string | null;
          entry_method: string | null;
          exit_method: string | null;
          feature: string | null;
          feed_rate: number | null;
          holder: string | null;
          id: string;
          job_id: string;
          linking_parameters: string | null;
          name: string | null;
          operation_type: string;
          sequence: number;
          setup_number: number;
          source: string;
          spindle_rpm: number | null;
          step_down: number | null;
          step_over: number | null;
          stock_to_leave: number | null;
          tolerance: number | null;
          tool_description: string | null;
          tool_id: string | null;
          tool_number: number | null;
          updated_at: string;
          validated: boolean;
          work_offset: string | null;
        };
        Insert: {
          clearance?: number | null;
          coolant?: string | null;
          created_at?: string;
          customer_requirement?: string | null;
          description?: string | null;
          entry_method?: string | null;
          exit_method?: string | null;
          feature?: string | null;
          feed_rate?: number | null;
          holder?: string | null;
          id?: string;
          job_id: string;
          linking_parameters?: string | null;
          name?: string | null;
          operation_type: string;
          sequence?: number;
          setup_number?: number;
          source?: string;
          spindle_rpm?: number | null;
          step_down?: number | null;
          step_over?: number | null;
          stock_to_leave?: number | null;
          tolerance?: number | null;
          tool_description?: string | null;
          tool_id?: string | null;
          tool_number?: number | null;
          updated_at?: string;
          validated?: boolean;
          work_offset?: string | null;
        };
        Update: {
          clearance?: number | null;
          coolant?: string | null;
          created_at?: string;
          customer_requirement?: string | null;
          description?: string | null;
          entry_method?: string | null;
          exit_method?: string | null;
          feature?: string | null;
          feed_rate?: number | null;
          holder?: string | null;
          id?: string;
          job_id?: string;
          linking_parameters?: string | null;
          name?: string | null;
          operation_type?: string;
          sequence?: number;
          setup_number?: number;
          source?: string;
          spindle_rpm?: number | null;
          step_down?: number | null;
          step_over?: number | null;
          stock_to_leave?: number | null;
          tolerance?: number | null;
          tool_description?: string | null;
          tool_id?: string | null;
          tool_number?: number | null;
          updated_at?: string;
          validated?: boolean;
          work_offset?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "operations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "operations_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "tooling_profiles";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          archived: boolean;
          created_at: string;
          created_by: string | null;
          headquarters: string | null;
          id: string;
          industry: string | null;
          name: string;
          primary_contact_email: string | null;
          primary_contact_name: string | null;
          primary_contact_phone: string | null;
          status: Database["public"]["Enums"]["entity_status"];
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          archived?: boolean;
          created_at?: string;
          created_by?: string | null;
          headquarters?: string | null;
          id?: string;
          industry?: string | null;
          name: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_contact_phone?: string | null;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived?: boolean;
          created_at?: string;
          created_by?: string | null;
          headquarters?: string | null;
          id?: string;
          industry?: string | null;
          name?: string;
          primary_contact_email?: string | null;
          primary_contact_name?: string | null;
          primary_contact_phone?: string | null;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [];
      };
      plan_reviews: {
        Row: {
          action: string;
          ai_plan_id: string | null;
          approved_plan: Json;
          change_reason: string | null;
          changes: string | null;
          created_at: string;
          id: string;
          job_id: string;
          programmer_instructions: string | null;
          reviewed_at: string;
          reviewer: string | null;
        };
        Insert: {
          action: string;
          ai_plan_id?: string | null;
          approved_plan?: Json;
          change_reason?: string | null;
          changes?: string | null;
          created_at?: string;
          id?: string;
          job_id: string;
          programmer_instructions?: string | null;
          reviewed_at?: string;
          reviewer?: string | null;
        };
        Update: {
          action?: string;
          ai_plan_id?: string | null;
          approved_plan?: Json;
          change_reason?: string | null;
          changes?: string | null;
          created_at?: string;
          id?: string;
          job_id?: string;
          programmer_instructions?: string | null;
          reviewed_at?: string;
          reviewer?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "plan_reviews_ai_plan_id_fkey";
            columns: ["ai_plan_id"];
            isOneToOne: false;
            referencedRelation: "ai_plans";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "plan_reviews_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      post_processors: {
        Row: {
          controller: string;
          created_at: string;
          id: string;
          is_approved: boolean;
          machine_family: string | null;
          name: string;
          notes: string | null;
          updated_at: string;
          version: string;
        };
        Insert: {
          controller: string;
          created_at?: string;
          id?: string;
          is_approved?: boolean;
          machine_family?: string | null;
          name: string;
          notes?: string | null;
          updated_at?: string;
          version?: string;
        };
        Update: {
          controller?: string;
          created_at?: string;
          id?: string;
          is_approved?: boolean;
          machine_family?: string | null;
          name?: string;
          notes?: string | null;
          updated_at?: string;
          version?: string;
        };
        Relationships: [];
      };
      post_records: {
        Row: {
          code_review: Json;
          code_text: string | null;
          control_definition: string | null;
          created_at: string;
          expected_tool_numbers: string | null;
          expected_work_offsets: string | null;
          id: string;
          job_id: string;
          machine_definition: string | null;
          mastercam_version: string | null;
          post_processor_id: string | null;
          post_processor_name: string | null;
          post_processor_version: string | null;
          posted_at: string;
          posted_by: string | null;
          program_number: string | null;
          program_revision: string | null;
          review_status: string;
        };
        Insert: {
          code_review?: Json;
          code_text?: string | null;
          control_definition?: string | null;
          created_at?: string;
          expected_tool_numbers?: string | null;
          expected_work_offsets?: string | null;
          id?: string;
          job_id: string;
          machine_definition?: string | null;
          mastercam_version?: string | null;
          post_processor_id?: string | null;
          post_processor_name?: string | null;
          post_processor_version?: string | null;
          posted_at?: string;
          posted_by?: string | null;
          program_number?: string | null;
          program_revision?: string | null;
          review_status?: string;
        };
        Update: {
          code_review?: Json;
          code_text?: string | null;
          control_definition?: string | null;
          created_at?: string;
          expected_tool_numbers?: string | null;
          expected_work_offsets?: string | null;
          id?: string;
          job_id?: string;
          machine_definition?: string | null;
          mastercam_version?: string | null;
          post_processor_id?: string | null;
          post_processor_name?: string | null;
          post_processor_version?: string | null;
          posted_at?: string;
          posted_by?: string | null;
          program_number?: string | null;
          program_revision?: string | null;
          review_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "post_records_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "post_records_post_processor_id_fkey";
            columns: ["post_processor_id"];
            isOneToOne: false;
            referencedRelation: "post_processors";
            referencedColumns: ["id"];
          },
        ];
      };
      profiles: {
        Row: {
          avatar_url: string | null;
          created_at: string;
          email: string | null;
          full_name: string | null;
          id: string;
          job_title: string | null;
          phone: string | null;
          status: Database["public"]["Enums"]["entity_status"];
          updated_at: string;
        };
        Insert: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id: string;
          job_title?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
        };
        Update: {
          avatar_url?: string | null;
          created_at?: string;
          email?: string | null;
          full_name?: string | null;
          id?: string;
          job_title?: string | null;
          phone?: string | null;
          status?: Database["public"]["Enums"]["entity_status"];
          updated_at?: string;
        };
        Relationships: [];
      };
      programmer_approvals: {
        Row: {
          acknowledged: boolean;
          action: string;
          approved_at: string;
          checklist: Json;
          id: string;
          job_id: string;
          mastercam_file_version: string | null;
          notes: string | null;
          program_version: string | null;
          programmer: string;
          programmer_name: string;
          simulation_status:
            Database["public"]["Enums"]["simulation_status"] | null;
        };
        Insert: {
          acknowledged?: boolean;
          action: string;
          approved_at?: string;
          checklist?: Json;
          id?: string;
          job_id: string;
          mastercam_file_version?: string | null;
          notes?: string | null;
          program_version?: string | null;
          programmer: string;
          programmer_name: string;
          simulation_status?:
            Database["public"]["Enums"]["simulation_status"] | null;
        };
        Update: {
          acknowledged?: boolean;
          action?: string;
          approved_at?: string;
          checklist?: Json;
          id?: string;
          job_id?: string;
          mastercam_file_version?: string | null;
          notes?: string | null;
          program_version?: string | null;
          programmer?: string;
          programmer_name?: string;
          simulation_status?:
            Database["public"]["Enums"]["simulation_status"] | null;
        };
        Relationships: [
          {
            foreignKeyName: "programmer_approvals_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      programmer_capabilities: {
        Row: {
          available: boolean;
          controllers: string[];
          created_at: string;
          id: string;
          machine_makes: string[];
          machine_models: string[];
          max_active_jobs: number;
          max_complexity: Database["public"]["Enums"]["complexity_level"];
          notes: string | null;
          programmer_id: string;
          updated_at: string;
        };
        Insert: {
          available?: boolean;
          controllers?: string[];
          created_at?: string;
          id?: string;
          machine_makes?: string[];
          machine_models?: string[];
          max_active_jobs?: number;
          max_complexity?: Database["public"]["Enums"]["complexity_level"];
          notes?: string | null;
          programmer_id: string;
          updated_at?: string;
        };
        Update: {
          available?: boolean;
          controllers?: string[];
          created_at?: string;
          id?: string;
          machine_makes?: string[];
          machine_models?: string[];
          max_active_jobs?: number;
          max_complexity?: Database["public"]["Enums"]["complexity_level"];
          notes?: string | null;
          programmer_id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      programming_work_orders: {
        Row: {
          actual_programming_hours: number | null;
          approved_drawing_file_id: string | null;
          approved_material: string | null;
          approved_model_file_id: string | null;
          approved_stock: string | null;
          assigned_programmer: string | null;
          created_at: string;
          created_by: string | null;
          due_date: string | null;
          estimated_programming_hours: number;
          facility_id: string | null;
          final_approved_at: string | null;
          final_approver: string | null;
          id: string;
          machine_confirmed: boolean;
          machine_definition: string | null;
          machine_id: string | null;
          organization_id: string;
          post_processor: string | null;
          post_processor_confirmed: boolean;
          priority: string;
          programmer_approved_at: string | null;
          programmer_approved_by: string | null;
          programmer_notes: string | null;
          quote_id: string | null;
          released_at: string | null;
          required_tooling: string | null;
          revision_confirmed: boolean;
          rfq_id: string;
          rfq_part_id: string | null;
          simulation_recorded: boolean;
          status: Database["public"]["Enums"]["work_order_status"];
          updated_at: string;
          work_order_number: string;
        };
        Insert: {
          actual_programming_hours?: number | null;
          approved_drawing_file_id?: string | null;
          approved_material?: string | null;
          approved_model_file_id?: string | null;
          approved_stock?: string | null;
          assigned_programmer?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          estimated_programming_hours?: number;
          facility_id?: string | null;
          final_approved_at?: string | null;
          final_approver?: string | null;
          id?: string;
          machine_confirmed?: boolean;
          machine_definition?: string | null;
          machine_id?: string | null;
          organization_id: string;
          post_processor?: string | null;
          post_processor_confirmed?: boolean;
          priority?: string;
          programmer_approved_at?: string | null;
          programmer_approved_by?: string | null;
          programmer_notes?: string | null;
          quote_id?: string | null;
          released_at?: string | null;
          required_tooling?: string | null;
          revision_confirmed?: boolean;
          rfq_id: string;
          rfq_part_id?: string | null;
          simulation_recorded?: boolean;
          status?: Database["public"]["Enums"]["work_order_status"];
          updated_at?: string;
          work_order_number: string;
        };
        Update: {
          actual_programming_hours?: number | null;
          approved_drawing_file_id?: string | null;
          approved_material?: string | null;
          approved_model_file_id?: string | null;
          approved_stock?: string | null;
          assigned_programmer?: string | null;
          created_at?: string;
          created_by?: string | null;
          due_date?: string | null;
          estimated_programming_hours?: number;
          facility_id?: string | null;
          final_approved_at?: string | null;
          final_approver?: string | null;
          id?: string;
          machine_confirmed?: boolean;
          machine_definition?: string | null;
          machine_id?: string | null;
          organization_id?: string;
          post_processor?: string | null;
          post_processor_confirmed?: boolean;
          priority?: string;
          programmer_approved_at?: string | null;
          programmer_approved_by?: string | null;
          programmer_notes?: string | null;
          quote_id?: string | null;
          released_at?: string | null;
          required_tooling?: string | null;
          revision_confirmed?: boolean;
          rfq_id?: string;
          rfq_part_id?: string | null;
          simulation_recorded?: boolean;
          status?: Database["public"]["Enums"]["work_order_status"];
          updated_at?: string;
          work_order_number?: string;
        };
        Relationships: [
          {
            foreignKeyName: "programming_work_orders_approved_drawing_file_id_fkey";
            columns: ["approved_drawing_file_id"];
            isOneToOne: false;
            referencedRelation: "rfq_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_approved_model_file_id_fkey";
            columns: ["approved_model_file_id"];
            isOneToOne: false;
            referencedRelation: "rfq_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_machine_id_fkey";
            columns: ["machine_id"];
            isOneToOne: false;
            referencedRelation: "machines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "programming_work_orders_rfq_part_id_fkey";
            columns: ["rfq_part_id"];
            isOneToOne: false;
            referencedRelation: "rfq_parts";
            referencedColumns: ["id"];
          },
        ];
      };
      project_findings: {
        Row: {
          created_at: string;
          finding_id: string;
          id: string;
          project_id: string;
        };
        Insert: {
          created_at?: string;
          finding_id: string;
          id?: string;
          project_id: string;
        };
        Update: {
          created_at?: string;
          finding_id?: string;
          id?: string;
          project_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "project_findings_finding_id_fkey";
            columns: ["finding_id"];
            isOneToOne: false;
            referencedRelation: "findings";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "project_findings_project_id_fkey";
            columns: ["project_id"];
            isOneToOne: false;
            referencedRelation: "improvement_projects";
            referencedColumns: ["id"];
          },
        ];
      };
      prove_out_results: {
        Row: {
          actual_cycle_time: number | null;
          actual_tooling: string | null;
          clearance_concerns: string | null;
          created_at: string;
          dimensional_results: string | null;
          feed_speed_changes: string | null;
          first_piece_accepted: boolean | null;
          fixture_changes: string | null;
          id: string;
          job_id: string;
          offset_changes: string | null;
          operator_feedback: string | null;
          planned_cycle_time: number | null;
          planned_tooling: string | null;
          program_changes: string | null;
          programmer_feedback: string | null;
          revision_reason: string | null;
          revision_required: boolean;
          setup_changes: string | null;
          simulated_cycle_time: number | null;
          submitted_by: string | null;
          surface_finish_results: string | null;
          tool_life_results: string | null;
        };
        Insert: {
          actual_cycle_time?: number | null;
          actual_tooling?: string | null;
          clearance_concerns?: string | null;
          created_at?: string;
          dimensional_results?: string | null;
          feed_speed_changes?: string | null;
          first_piece_accepted?: boolean | null;
          fixture_changes?: string | null;
          id?: string;
          job_id: string;
          offset_changes?: string | null;
          operator_feedback?: string | null;
          planned_cycle_time?: number | null;
          planned_tooling?: string | null;
          program_changes?: string | null;
          programmer_feedback?: string | null;
          revision_reason?: string | null;
          revision_required?: boolean;
          setup_changes?: string | null;
          simulated_cycle_time?: number | null;
          submitted_by?: string | null;
          surface_finish_results?: string | null;
          tool_life_results?: string | null;
        };
        Update: {
          actual_cycle_time?: number | null;
          actual_tooling?: string | null;
          clearance_concerns?: string | null;
          created_at?: string;
          dimensional_results?: string | null;
          feed_speed_changes?: string | null;
          first_piece_accepted?: boolean | null;
          fixture_changes?: string | null;
          id?: string;
          job_id?: string;
          offset_changes?: string | null;
          operator_feedback?: string | null;
          planned_cycle_time?: number | null;
          planned_tooling?: string | null;
          program_changes?: string | null;
          programmer_feedback?: string | null;
          revision_reason?: string | null;
          revision_required?: boolean;
          setup_changes?: string | null;
          simulated_cycle_time?: number | null;
          submitted_by?: string | null;
          surface_finish_results?: string | null;
          tool_life_results?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "prove_out_results_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_approvals: {
        Row: {
          approved_at: string;
          approver_id: string | null;
          created_at: string;
          decision: string;
          id: string;
          notes: string | null;
          quote_id: string;
        };
        Insert: {
          approved_at?: string;
          approver_id?: string | null;
          created_at?: string;
          decision: string;
          id?: string;
          notes?: string | null;
          quote_id: string;
        };
        Update: {
          approved_at?: string;
          approver_id?: string | null;
          created_at?: string;
          decision?: string;
          id?: string;
          notes?: string | null;
          quote_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quote_approvals_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quote_revisions: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          quote_id: string;
          reason: string | null;
          revision: number;
          snapshot: Json;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          quote_id: string;
          reason?: string | null;
          revision: number;
          snapshot?: Json;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          quote_id?: string;
          reason?: string | null;
          revision?: number;
          snapshot?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "quote_revisions_quote_id_fkey";
            columns: ["quote_id"];
            isOneToOne: false;
            referencedRelation: "quotes";
            referencedColumns: ["id"];
          },
        ];
      };
      quotes: {
        Row: {
          assumptions: string | null;
          created_at: string;
          created_by: string | null;
          customer_response_note: string | null;
          estimate_id: string | null;
          exclusions: string | null;
          expires_on: string | null;
          facility_id: string | null;
          freight_terms: string | null;
          id: string;
          lead_time_days: number | null;
          nre_charge: number;
          organization_id: string;
          payment_terms: string | null;
          preliminary: boolean;
          quantity: number;
          quantity_breaks: Json;
          quote_number: string;
          responded_at: string | null;
          revision: number;
          rfq_id: string;
          sent_at: string | null;
          status: Database["public"]["Enums"]["quote_status"];
          tooling_charge: number;
          unit_price: number;
          updated_at: string;
        };
        Insert: {
          assumptions?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_response_note?: string | null;
          estimate_id?: string | null;
          exclusions?: string | null;
          expires_on?: string | null;
          facility_id?: string | null;
          freight_terms?: string | null;
          id?: string;
          lead_time_days?: number | null;
          nre_charge?: number;
          organization_id: string;
          payment_terms?: string | null;
          preliminary?: boolean;
          quantity?: number;
          quantity_breaks?: Json;
          quote_number: string;
          responded_at?: string | null;
          revision?: number;
          rfq_id: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          tooling_charge?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Update: {
          assumptions?: string | null;
          created_at?: string;
          created_by?: string | null;
          customer_response_note?: string | null;
          estimate_id?: string | null;
          exclusions?: string | null;
          expires_on?: string | null;
          facility_id?: string | null;
          freight_terms?: string | null;
          id?: string;
          lead_time_days?: number | null;
          nre_charge?: number;
          organization_id?: string;
          payment_terms?: string | null;
          preliminary?: boolean;
          quantity?: number;
          quantity_breaks?: Json;
          quote_number?: string;
          responded_at?: string | null;
          revision?: number;
          rfq_id?: string;
          sent_at?: string | null;
          status?: Database["public"]["Enums"]["quote_status"];
          tooling_charge?: number;
          unit_price?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "quotes_estimate_id_fkey";
            columns: ["estimate_id"];
            isOneToOne: false;
            referencedRelation: "estimates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "quotes_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
        ];
      };
      readiness_history: {
        Row: {
          confidence_score: number | null;
          created_at: string;
          facility_id: string;
          id: string;
          overall_score: number;
          period_label: string;
          recorded_on: string;
        };
        Insert: {
          confidence_score?: number | null;
          created_at?: string;
          facility_id: string;
          id?: string;
          overall_score: number;
          period_label: string;
          recorded_on: string;
        };
        Update: {
          confidence_score?: number | null;
          created_at?: string;
          facility_id?: string;
          id?: string;
          overall_score?: number;
          period_label?: string;
          recorded_on?: string;
        };
        Relationships: [
          {
            foreignKeyName: "readiness_history_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
        ];
      };
      release_packages: {
        Row: {
          contents: Json;
          created_at: string;
          id: string;
          job_id: string;
          license_text: string | null;
          released: boolean;
          released_at: string | null;
          released_by: string | null;
          updated_at: string;
        };
        Insert: {
          contents?: Json;
          created_at?: string;
          id?: string;
          job_id: string;
          license_text?: string | null;
          released?: boolean;
          released_at?: string | null;
          released_by?: string | null;
          updated_at?: string;
        };
        Update: {
          contents?: Json;
          created_at?: string;
          id?: string;
          job_id?: string;
          license_text?: string | null;
          released?: boolean;
          released_at?: string | null;
          released_by?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "release_packages_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      rfq_files: {
        Row: {
          bucket: string;
          checksum: string | null;
          created_at: string;
          created_by: string | null;
          file_extension: string;
          file_kind: Database["public"]["Enums"]["rfq_file_kind"];
          file_name: string;
          file_size: number;
          id: string;
          organization_id: string;
          revision: number;
          rfq_id: string;
          rfq_part_id: string | null;
          storage_path: string;
          superseded: boolean;
          updated_at: string;
          upload_status: string;
        };
        Insert: {
          bucket: string;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_extension: string;
          file_kind?: Database["public"]["Enums"]["rfq_file_kind"];
          file_name: string;
          file_size?: number;
          id?: string;
          organization_id: string;
          revision?: number;
          rfq_id: string;
          rfq_part_id?: string | null;
          storage_path: string;
          superseded?: boolean;
          updated_at?: string;
          upload_status?: string;
        };
        Update: {
          bucket?: string;
          checksum?: string | null;
          created_at?: string;
          created_by?: string | null;
          file_extension?: string;
          file_kind?: Database["public"]["Enums"]["rfq_file_kind"];
          file_name?: string;
          file_size?: number;
          id?: string;
          organization_id?: string;
          revision?: number;
          rfq_id?: string;
          rfq_part_id?: string | null;
          storage_path?: string;
          superseded?: boolean;
          updated_at?: string;
          upload_status?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rfq_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rfq_files_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rfq_files_rfq_part_id_fkey";
            columns: ["rfq_part_id"];
            isOneToOne: false;
            referencedRelation: "rfq_parts";
            referencedColumns: ["id"];
          },
        ];
      };
      rfq_parts: {
        Row: {
          created_at: string;
          created_by: string | null;
          description: string | null;
          id: string;
          organization_id: string;
          part_number: string;
          quantity: number;
          quantity_breaks: Json;
          revision: string | null;
          rfq_id: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          organization_id: string;
          part_number: string;
          quantity?: number;
          quantity_breaks?: Json;
          revision?: string | null;
          rfq_id: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          description?: string | null;
          id?: string;
          organization_id?: string;
          part_number?: string;
          quantity?: number;
          quantity_breaks?: Json;
          revision?: string | null;
          rfq_id?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rfq_parts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rfq_parts_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
        ];
      };
      rfq_requirements: {
        Row: {
          coating: string | null;
          created_at: string;
          created_by: string | null;
          critical_tolerances: string | null;
          customer_required_machine: string | null;
          customer_supplied_material: boolean;
          existing_fixture: boolean;
          existing_program: boolean;
          existing_tooling_notes: string | null;
          fai_required: boolean;
          general_tolerance: string | null;
          heat_treatment: string | null;
          id: string;
          inspection_level: string | null;
          material_certification: boolean;
          material_grade: string | null;
          material_id: string | null;
          material_text: string | null;
          notes: string | null;
          preferred_process: string | null;
          requested_machine_type:
            Database["public"]["Enums"]["machine_type"] | null;
          requested_turnaround_days: number | null;
          rfq_part_id: string;
          special_packaging: string | null;
          stock_dim_a: number | null;
          stock_dim_b: number | null;
          stock_dim_c: number | null;
          stock_shape: string | null;
          surface_finish: string | null;
          target_price: number | null;
          thread_requirements: string | null;
          units: string;
          updated_at: string;
        };
        Insert: {
          coating?: string | null;
          created_at?: string;
          created_by?: string | null;
          critical_tolerances?: string | null;
          customer_required_machine?: string | null;
          customer_supplied_material?: boolean;
          existing_fixture?: boolean;
          existing_program?: boolean;
          existing_tooling_notes?: string | null;
          fai_required?: boolean;
          general_tolerance?: string | null;
          heat_treatment?: string | null;
          id?: string;
          inspection_level?: string | null;
          material_certification?: boolean;
          material_grade?: string | null;
          material_id?: string | null;
          material_text?: string | null;
          notes?: string | null;
          preferred_process?: string | null;
          requested_machine_type?:
            Database["public"]["Enums"]["machine_type"] | null;
          requested_turnaround_days?: number | null;
          rfq_part_id: string;
          special_packaging?: string | null;
          stock_dim_a?: number | null;
          stock_dim_b?: number | null;
          stock_dim_c?: number | null;
          stock_shape?: string | null;
          surface_finish?: string | null;
          target_price?: number | null;
          thread_requirements?: string | null;
          units?: string;
          updated_at?: string;
        };
        Update: {
          coating?: string | null;
          created_at?: string;
          created_by?: string | null;
          critical_tolerances?: string | null;
          customer_required_machine?: string | null;
          customer_supplied_material?: boolean;
          existing_fixture?: boolean;
          existing_program?: boolean;
          existing_tooling_notes?: string | null;
          fai_required?: boolean;
          general_tolerance?: string | null;
          heat_treatment?: string | null;
          id?: string;
          inspection_level?: string | null;
          material_certification?: boolean;
          material_grade?: string | null;
          material_id?: string | null;
          material_text?: string | null;
          notes?: string | null;
          preferred_process?: string | null;
          requested_machine_type?:
            Database["public"]["Enums"]["machine_type"] | null;
          requested_turnaround_days?: number | null;
          rfq_part_id?: string;
          special_packaging?: string | null;
          stock_dim_a?: number | null;
          stock_dim_b?: number | null;
          stock_dim_c?: number | null;
          stock_shape?: string | null;
          surface_finish?: string | null;
          target_price?: number | null;
          thread_requirements?: string | null;
          units?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rfq_requirements_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rfq_requirements_rfq_part_id_fkey";
            columns: ["rfq_part_id"];
            isOneToOne: false;
            referencedRelation: "rfq_parts";
            referencedColumns: ["id"];
          },
        ];
      };
      rfq_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["rfq_status"] | null;
          id: string;
          note: string | null;
          rfq_id: string;
          to_status: Database["public"]["Enums"]["rfq_status"];
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["rfq_status"] | null;
          id?: string;
          note?: string | null;
          rfq_id: string;
          to_status: Database["public"]["Enums"]["rfq_status"];
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["rfq_status"] | null;
          id?: string;
          note?: string | null;
          rfq_id?: string;
          to_status?: Database["public"]["Enums"]["rfq_status"];
        };
        Relationships: [
          {
            foreignKeyName: "rfq_status_history_rfq_id_fkey";
            columns: ["rfq_id"];
            isOneToOne: false;
            referencedRelation: "rfqs";
            referencedColumns: ["id"];
          },
        ];
      };
      rfqs: {
        Row: {
          assigned_estimator: string | null;
          assigned_programmer: string | null;
          contact_email: string | null;
          contact_name: string | null;
          created_at: string;
          created_by: string | null;
          cui: boolean;
          customer_rfq_number: string | null;
          export_controlled: boolean;
          facility_id: string | null;
          files_use_confirmed: boolean;
          id: string;
          itar: boolean;
          notes: string | null;
          organization_id: string;
          project_description: string | null;
          required_date: string | null;
          rfq_kind: Database["public"]["Enums"]["rfq_kind"];
          rfq_number: string;
          status: Database["public"]["Enums"]["rfq_status"];
          submitted_at: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          assigned_estimator?: string | null;
          assigned_programmer?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          cui?: boolean;
          customer_rfq_number?: string | null;
          export_controlled?: boolean;
          facility_id?: string | null;
          files_use_confirmed?: boolean;
          id?: string;
          itar?: boolean;
          notes?: string | null;
          organization_id: string;
          project_description?: string | null;
          required_date?: string | null;
          rfq_kind?: Database["public"]["Enums"]["rfq_kind"];
          rfq_number: string;
          status?: Database["public"]["Enums"]["rfq_status"];
          submitted_at?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          assigned_estimator?: string | null;
          assigned_programmer?: string | null;
          contact_email?: string | null;
          contact_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          cui?: boolean;
          customer_rfq_number?: string | null;
          export_controlled?: boolean;
          facility_id?: string | null;
          files_use_confirmed?: boolean;
          id?: string;
          itar?: boolean;
          notes?: string | null;
          organization_id?: string;
          project_description?: string | null;
          required_date?: string | null;
          rfq_kind?: Database["public"]["Enums"]["rfq_kind"];
          rfq_number?: string;
          status?: Database["public"]["Enums"]["rfq_status"];
          submitted_at?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "rfqs_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "rfqs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      setup_sheets: {
        Row: {
          content: Json;
          created_at: string;
          id: string;
          job_id: string;
          reviewed: boolean;
          reviewed_at: string | null;
          reviewer: string | null;
          updated_at: string;
        };
        Insert: {
          content?: Json;
          created_at?: string;
          id?: string;
          job_id: string;
          reviewed?: boolean;
          reviewed_at?: string | null;
          reviewer?: string | null;
          updated_at?: string;
        };
        Update: {
          content?: Json;
          created_at?: string;
          id?: string;
          job_id?: string;
          reviewed?: boolean;
          reviewed_at?: string | null;
          reviewer?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "setup_sheets_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      simulation_results: {
        Row: {
          collisions: number;
          created_at: string;
          created_by: string | null;
          cycle_time_minutes: number | null;
          gouges: number;
          id: string;
          nc_program_id: string | null;
          notes: string | null;
          organization_id: string;
          outcome: string;
          report_bucket: string | null;
          report_path: string | null;
          work_order_id: string;
        };
        Insert: {
          collisions?: number;
          created_at?: string;
          created_by?: string | null;
          cycle_time_minutes?: number | null;
          gouges?: number;
          id?: string;
          nc_program_id?: string | null;
          notes?: string | null;
          organization_id: string;
          outcome: string;
          report_bucket?: string | null;
          report_path?: string | null;
          work_order_id: string;
        };
        Update: {
          collisions?: number;
          created_at?: string;
          created_by?: string | null;
          cycle_time_minutes?: number | null;
          gouges?: number;
          id?: string;
          nc_program_id?: string | null;
          notes?: string | null;
          organization_id?: string;
          outcome?: string;
          report_bucket?: string | null;
          report_path?: string | null;
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "simulation_results_nc_program_id_fkey";
            columns: ["nc_program_id"];
            isOneToOne: false;
            referencedRelation: "nc_programs";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulation_results_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "simulation_results_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "programming_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      simulations: {
        Row: {
          collisions: string | null;
          corrective_actions: string | null;
          created_at: string;
          estimated_cycle_time: number | null;
          id: string;
          job_id: string;
          machine_definition_version: string | null;
          mastercam_version: string | null;
          post_processor_version: string | null;
          program_version: string | null;
          results: Json;
          simulated_at: string | null;
          simulated_by: string | null;
          software_version: string | null;
          status: Database["public"]["Enums"]["simulation_status"];
          warnings: string | null;
        };
        Insert: {
          collisions?: string | null;
          corrective_actions?: string | null;
          created_at?: string;
          estimated_cycle_time?: number | null;
          id?: string;
          job_id: string;
          machine_definition_version?: string | null;
          mastercam_version?: string | null;
          post_processor_version?: string | null;
          program_version?: string | null;
          results?: Json;
          simulated_at?: string | null;
          simulated_by?: string | null;
          software_version?: string | null;
          status?: Database["public"]["Enums"]["simulation_status"];
          warnings?: string | null;
        };
        Update: {
          collisions?: string | null;
          corrective_actions?: string | null;
          created_at?: string;
          estimated_cycle_time?: number | null;
          id?: string;
          job_id?: string;
          machine_definition_version?: string | null;
          mastercam_version?: string | null;
          post_processor_version?: string | null;
          program_version?: string | null;
          results?: Json;
          simulated_at?: string | null;
          simulated_by?: string | null;
          software_version?: string | null;
          status?: Database["public"]["Enums"]["simulation_status"];
          warnings?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "simulations_job_id_fkey";
            columns: ["job_id"];
            isOneToOne: false;
            referencedRelation: "jobs";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_catalog: {
        Row: {
          active: boolean;
          cost_per_unit: number | null;
          created_at: string;
          created_by: string | null;
          dimension_a: number | null;
          dimension_b: number | null;
          dimension_c: number | null;
          id: string;
          material_id: string;
          shape: string;
          supplier: string | null;
          units: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          cost_per_unit?: number | null;
          created_at?: string;
          created_by?: string | null;
          dimension_a?: number | null;
          dimension_b?: number | null;
          dimension_c?: number | null;
          id?: string;
          material_id: string;
          shape: string;
          supplier?: string | null;
          units?: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          cost_per_unit?: number | null;
          created_at?: string;
          created_by?: string | null;
          dimension_a?: number | null;
          dimension_b?: number | null;
          dimension_c?: number | null;
          id?: string;
          material_id?: string;
          shape?: string;
          supplier?: string | null;
          units?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_catalog_material_id_fkey";
            columns: ["material_id"];
            isOneToOne: false;
            referencedRelation: "materials";
            referencedColumns: ["id"];
          },
        ];
      };
      tool_inventory: {
        Row: {
          created_at: string;
          facility_id: string | null;
          id: string;
          location: string | null;
          quantity_on_hand: number;
          reorder_point: number;
          tool_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          facility_id?: string | null;
          id?: string;
          location?: string | null;
          quantity_on_hand?: number;
          reorder_point?: number;
          tool_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          facility_id?: string | null;
          id?: string;
          location?: string | null;
          quantity_on_hand?: number;
          reorder_point?: number;
          tool_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tool_inventory_facility_id_fkey";
            columns: ["facility_id"];
            isOneToOne: false;
            referencedRelation: "facilities";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "tool_inventory_tool_id_fkey";
            columns: ["tool_id"];
            isOneToOne: false;
            referencedRelation: "tools";
            referencedColumns: ["id"];
          },
        ];
      };
      tooling_profiles: {
        Row: {
          corner_radius: number | null;
          created_at: string;
          description: string;
          diameter: number | null;
          flute_count: number | null;
          holder: string | null;
          id: string;
          is_approved: boolean;
          material: string | null;
          notes: string | null;
          organization_id: string | null;
          overall_length: number | null;
          stick_out: number | null;
          tool_number: number | null;
          tool_type: string;
          updated_at: string;
        };
        Insert: {
          corner_radius?: number | null;
          created_at?: string;
          description: string;
          diameter?: number | null;
          flute_count?: number | null;
          holder?: string | null;
          id?: string;
          is_approved?: boolean;
          material?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          overall_length?: number | null;
          stick_out?: number | null;
          tool_number?: number | null;
          tool_type: string;
          updated_at?: string;
        };
        Update: {
          corner_radius?: number | null;
          created_at?: string;
          description?: string;
          diameter?: number | null;
          flute_count?: number | null;
          holder?: string | null;
          id?: string;
          is_approved?: boolean;
          material?: string | null;
          notes?: string | null;
          organization_id?: string | null;
          overall_length?: number | null;
          stick_out?: number | null;
          tool_number?: number | null;
          tool_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tooling_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      tools: {
        Row: {
          active: boolean;
          coating: string | null;
          cost: number;
          created_at: string;
          created_by: string | null;
          description: string;
          diameter: number | null;
          expected_life_minutes: number | null;
          flute_count: number | null;
          id: string;
          material: string | null;
          organization_id: string | null;
          supplier: string | null;
          tool_number: string | null;
          tool_type: string;
          updated_at: string;
        };
        Insert: {
          active?: boolean;
          coating?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description: string;
          diameter?: number | null;
          expected_life_minutes?: number | null;
          flute_count?: number | null;
          id?: string;
          material?: string | null;
          organization_id?: string | null;
          supplier?: string | null;
          tool_number?: string | null;
          tool_type: string;
          updated_at?: string;
        };
        Update: {
          active?: boolean;
          coating?: string | null;
          cost?: number;
          created_at?: string;
          created_by?: string | null;
          description?: string;
          diameter?: number | null;
          expected_life_minutes?: number | null;
          flute_count?: number | null;
          id?: string;
          material?: string | null;
          organization_id?: string | null;
          supplier?: string | null;
          tool_number?: string | null;
          tool_type?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "tools_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
      work_order_status_history: {
        Row: {
          changed_by: string | null;
          created_at: string;
          from_status: Database["public"]["Enums"]["work_order_status"] | null;
          id: string;
          note: string | null;
          to_status: Database["public"]["Enums"]["work_order_status"];
          work_order_id: string;
        };
        Insert: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["work_order_status"] | null;
          id?: string;
          note?: string | null;
          to_status: Database["public"]["Enums"]["work_order_status"];
          work_order_id: string;
        };
        Update: {
          changed_by?: string | null;
          created_at?: string;
          from_status?: Database["public"]["Enums"]["work_order_status"] | null;
          id?: string;
          note?: string | null;
          to_status?: Database["public"]["Enums"]["work_order_status"];
          work_order_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "work_order_status_history_work_order_id_fkey";
            columns: ["work_order_id"];
            isOneToOne: false;
            referencedRelation: "programming_work_orders";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      clone_template_version: {
        Args: { _notes?: string; _version_id: string };
        Returns: string;
      };
      complexity_rank: {
        Args: { _c: Database["public"]["Enums"]["complexity_level"] };
        Returns: number;
      };
      next_finding_code: { Args: never; Returns: string };
      next_job_number: { Args: never; Returns: string };
      next_quote_number: { Args: never; Returns: string };
      next_rfq_number: { Args: never; Returns: string };
      next_work_order_number: { Args: never; Returns: string };
      publish_template_version: {
        Args: { _version_id: string };
        Returns: undefined;
      };
      select_programmer_for_job: { Args: { _job_id: string }; Returns: string };
    };
    Enums: {
      app_role:
        | "ironiq_admin"
        | "consultant"
        | "customer_admin"
        | "facility_manager"
        | "assessor"
        | "executive"
        | "client"
        | "programmer"
        | "project_manager";
      assessment_status:
        "draft" | "in_progress" | "review" | "finalized" | "reopened";
      cap_action_status:
        | "identified"
        | "recommended"
        | "approved"
        | "in_progress"
        | "validation"
        | "complete"
        | "sustained";
      cap_assessment_status:
        | "draft"
        | "intake"
        | "in_progress"
        | "review"
        | "finalized"
        | "reopened";
      cap_confidence: "low" | "moderate" | "high" | "verified";
      cap_dimension:
        | "availability"
        | "capability"
        | "consistency"
        | "control"
        | "sustainability";
      cap_evidence_type:
        | "direct_observation"
        | "customer_interview"
        | "document_review"
        | "production_data"
        | "quality_data"
        | "erp_mes_data"
        | "machine_data"
        | "photograph"
        | "file"
        | "drawing"
        | "cnc_program"
        | "setup_documentation"
        | "maintenance_record"
        | "training_record"
        | "other";
      cap_finding_class:
        | "primary_constraint"
        | "contributing_constraint"
        | "risk"
        | "opportunity"
        | "strength";
      cap_perf_category:
        | "production"
        | "quality"
        | "cost"
        | "delivery"
        | "workforce"
        | "throughput"
        | "downtime"
        | "capacity"
        | "scrap_rework"
        | "setup_time"
        | "lead_time"
        | "reliability";
      cap_priority: "immediate" | "high" | "moderate" | "monitor";
      cap_source: "customer_stated" | "ironclad_validated";
      cap_validation_result:
        | "capability_restored"
        | "capability_strengthened"
        | "partially_restored"
        | "additional_action_required"
        | "performance_degraded";
      check_severity: "critical" | "review_required" | "advisory" | "passed";
      complexity_level: "low" | "moderate" | "high" | "very_high";
      entity_status: "active" | "inactive" | "archived" | "prospect";
      estimate_confidence: "high" | "moderate" | "low" | "manual_required";
      evidence_type:
        | "none"
        | "verbal"
        | "document"
        | "record_sampled"
        | "direct_observation"
        | "system_data";
      exception_kind:
        | "missing_customer_information"
        | "digital_data_recovery"
        | "unsupported_machine_or_controller"
        | "tooling_gap"
        | "fixture_gap";
      exception_status: "pending" | "approved" | "denied";
      finding_severity: "critical" | "high" | "medium" | "low" | "opportunity";
      finding_status:
        | "open"
        | "assigned"
        | "in_progress"
        | "awaiting_verification"
        | "closed"
        | "accepted_risk";
      intake_result:
        | "ready_for_ai_planning"
        | "human_intake_review_required"
        | "missing_customer_information"
        | "tooling_review_required"
        | "fixture_review_required"
        | "digital_data_recovery_required"
        | "unsupported_machine_or_controller"
        | "manual_programming_required";
      integration_mode:
        "direct_automation" | "guided_add_in" | "structured_package";
      job_status:
        | "customer_submission_draft"
        | "customer_data_submitted"
        | "iss_intake_review"
        | "missing_information"
        | "digital_data_recovery_required"
        | "machine_profile_review"
        | "tooling_review_required"
        | "fixture_review_required"
        | "ready_for_ai_planning"
        | "ai_manufacturing_plan_in_progress"
        | "ai_manufacturing_plan_generated"
        | "programmer_plan_review"
        | "manufacturing_plan_approved"
        | "mastercam_integration_pending"
        | "mastercam_job_created"
        | "toolpath_generation_in_progress"
        | "preliminary_toolpaths_generated"
        | "automated_checks_in_progress"
        | "corrections_required"
        | "ready_for_simulation"
        | "simulation_in_progress"
        | "simulation_failed"
        | "simulation_passed_with_warnings"
        | "simulation_passed"
        | "programmer_approval_pending"
        | "programmer_revisions_in_progress"
        | "programmer_approved"
        | "posting_in_progress"
        | "posted_code_review"
        | "setup_sheet_generation"
        | "final_technical_review"
        | "ready_for_customer_release"
        | "released_to_customer"
        | "customer_prove_out"
        | "revision_requested"
        | "completed";
      machine_type:
        | "mill_3axis"
        | "mill_4axis"
        | "mill_5axis"
        | "lathe"
        | "mill_turn"
        | "router"
        | "edm"
        | "grinding"
        | "other";
      project_status:
        | "proposed"
        | "planned"
        | "in_progress"
        | "on_hold"
        | "complete"
        | "cancelled";
      quote_status:
        | "draft"
        | "pending_approval"
        | "approved"
        | "returned"
        | "rejected"
        | "sent"
        | "accepted"
        | "declined"
        | "changes_requested"
        | "expired";
      recommendation_decision:
        "accepted" | "modified" | "rejected" | "not_applicable";
      rfq_file_kind:
        | "model_3d"
        | "drawing"
        | "supporting"
        | "cam"
        | "nc_program"
        | "simulation_report"
        | "quote_document";
      rfq_kind: "prototype" | "repeat_production" | "new_production";
      rfq_status:
        | "new"
        | "awaiting_information"
        | "geometry_analysis"
        | "ready_for_estimating"
        | "awaiting_internal_approval"
        | "quote_sent"
        | "quote_accepted"
        | "programming"
        | "awaiting_verification"
        | "completed"
        | "declined"
        | "expired";
      simulation_status:
        | "not_simulated"
        | "simulation_in_progress"
        | "simulation_failed"
        | "corrections_required"
        | "simulation_passed_with_warnings"
        | "simulation_passed"
        | "human_verification_required";
      template_status: "draft" | "published" | "archived";
      work_order_status:
        | "not_started"
        | "reviewing_files"
        | "programming"
        | "internal_questions"
        | "customer_clarification"
        | "simulation"
        | "revision_required"
        | "approved"
        | "released"
        | "completed";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<
  keyof Database,
  "public"
>];

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
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
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
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
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
      app_role: [
        "ironiq_admin",
        "consultant",
        "customer_admin",
        "facility_manager",
        "assessor",
        "executive",
        "client",
        "programmer",
        "project_manager",
      ],
      assessment_status: [
        "draft",
        "in_progress",
        "review",
        "finalized",
        "reopened",
      ],
      cap_action_status: [
        "identified",
        "recommended",
        "approved",
        "in_progress",
        "validation",
        "complete",
        "sustained",
      ],
      cap_assessment_status: [
        "draft",
        "intake",
        "in_progress",
        "review",
        "finalized",
        "reopened",
      ],
      cap_confidence: ["low", "moderate", "high", "verified"],
      cap_dimension: [
        "availability",
        "capability",
        "consistency",
        "control",
        "sustainability",
      ],
      cap_evidence_type: [
        "direct_observation",
        "customer_interview",
        "document_review",
        "production_data",
        "quality_data",
        "erp_mes_data",
        "machine_data",
        "photograph",
        "file",
        "drawing",
        "cnc_program",
        "setup_documentation",
        "maintenance_record",
        "training_record",
        "other",
      ],
      cap_finding_class: [
        "primary_constraint",
        "contributing_constraint",
        "risk",
        "opportunity",
        "strength",
      ],
      cap_perf_category: [
        "production",
        "quality",
        "cost",
        "delivery",
        "workforce",
        "throughput",
        "downtime",
        "capacity",
        "scrap_rework",
        "setup_time",
        "lead_time",
        "reliability",
      ],
      cap_priority: ["immediate", "high", "moderate", "monitor"],
      cap_source: ["customer_stated", "ironclad_validated"],
      cap_validation_result: [
        "capability_restored",
        "capability_strengthened",
        "partially_restored",
        "additional_action_required",
        "performance_degraded",
      ],
      check_severity: ["critical", "review_required", "advisory", "passed"],
      complexity_level: ["low", "moderate", "high", "very_high"],
      entity_status: ["active", "inactive", "archived", "prospect"],
      estimate_confidence: ["high", "moderate", "low", "manual_required"],
      evidence_type: [
        "none",
        "verbal",
        "document",
        "record_sampled",
        "direct_observation",
        "system_data",
      ],
      exception_kind: [
        "missing_customer_information",
        "digital_data_recovery",
        "unsupported_machine_or_controller",
        "tooling_gap",
        "fixture_gap",
      ],
      exception_status: ["pending", "approved", "denied"],
      finding_severity: ["critical", "high", "medium", "low", "opportunity"],
      finding_status: [
        "open",
        "assigned",
        "in_progress",
        "awaiting_verification",
        "closed",
        "accepted_risk",
      ],
      intake_result: [
        "ready_for_ai_planning",
        "human_intake_review_required",
        "missing_customer_information",
        "tooling_review_required",
        "fixture_review_required",
        "digital_data_recovery_required",
        "unsupported_machine_or_controller",
        "manual_programming_required",
      ],
      integration_mode: [
        "direct_automation",
        "guided_add_in",
        "structured_package",
      ],
      job_status: [
        "customer_submission_draft",
        "customer_data_submitted",
        "iss_intake_review",
        "missing_information",
        "digital_data_recovery_required",
        "machine_profile_review",
        "tooling_review_required",
        "fixture_review_required",
        "ready_for_ai_planning",
        "ai_manufacturing_plan_in_progress",
        "ai_manufacturing_plan_generated",
        "programmer_plan_review",
        "manufacturing_plan_approved",
        "mastercam_integration_pending",
        "mastercam_job_created",
        "toolpath_generation_in_progress",
        "preliminary_toolpaths_generated",
        "automated_checks_in_progress",
        "corrections_required",
        "ready_for_simulation",
        "simulation_in_progress",
        "simulation_failed",
        "simulation_passed_with_warnings",
        "simulation_passed",
        "programmer_approval_pending",
        "programmer_revisions_in_progress",
        "programmer_approved",
        "posting_in_progress",
        "posted_code_review",
        "setup_sheet_generation",
        "final_technical_review",
        "ready_for_customer_release",
        "released_to_customer",
        "customer_prove_out",
        "revision_requested",
        "completed",
      ],
      machine_type: [
        "mill_3axis",
        "mill_4axis",
        "mill_5axis",
        "lathe",
        "mill_turn",
        "router",
        "edm",
        "grinding",
        "other",
      ],
      project_status: [
        "proposed",
        "planned",
        "in_progress",
        "on_hold",
        "complete",
        "cancelled",
      ],
      quote_status: [
        "draft",
        "pending_approval",
        "approved",
        "returned",
        "rejected",
        "sent",
        "accepted",
        "declined",
        "changes_requested",
        "expired",
      ],
      recommendation_decision: [
        "accepted",
        "modified",
        "rejected",
        "not_applicable",
      ],
      rfq_file_kind: [
        "model_3d",
        "drawing",
        "supporting",
        "cam",
        "nc_program",
        "simulation_report",
        "quote_document",
      ],
      rfq_kind: ["prototype", "repeat_production", "new_production"],
      rfq_status: [
        "new",
        "awaiting_information",
        "geometry_analysis",
        "ready_for_estimating",
        "awaiting_internal_approval",
        "quote_sent",
        "quote_accepted",
        "programming",
        "awaiting_verification",
        "completed",
        "declined",
        "expired",
      ],
      simulation_status: [
        "not_simulated",
        "simulation_in_progress",
        "simulation_failed",
        "corrections_required",
        "simulation_passed_with_warnings",
        "simulation_passed",
        "human_verification_required",
      ],
      template_status: ["draft", "published", "archived"],
      work_order_status: [
        "not_started",
        "reviewing_files",
        "programming",
        "internal_questions",
        "customer_clarification",
        "simulation",
        "revision_required",
        "approved",
        "released",
        "completed",
      ],
    },
  },
} as const;
