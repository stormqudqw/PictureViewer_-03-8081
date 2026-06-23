CREATE TYPE "public"."cargo_type" AS ENUM('ltl', 'ftl', 'oog');--> statement-breakpoint
CREATE TYPE "public"."country" AS ENUM('RU', 'KZ', 'BY');--> statement-breakpoint
CREATE TYPE "public"."lead_status" AS ENUM('new', 'in_progress', 'done', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."speed" AS ENUM('std', 'express');--> statement-breakpoint
CREATE TABLE "cities" (
	"code" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"country" "country" NOT NULL,
	"lat" double precision NOT NULL,
	"lng" double precision NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leads" (
	"id" serial PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"phone" text NOT NULL,
	"message" text,
	"from_code" text,
	"to_code" text,
	"weight_kg" integer,
	"volume_m3" double precision,
	"cargo_type" "cargo_type",
	"speed" "speed",
	"estimated_price" integer,
	"status" "lead_status" DEFAULT 'new' NOT NULL,
	"source" text DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
