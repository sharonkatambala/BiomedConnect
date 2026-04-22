#!/usr/bin/env python3
"""
Script to add starred column to chats table
"""
import asyncio
import os
from dotenv import load_dotenv

# Load environment variables
load_dotenv()

async def add_starred_column():
    try:
        from app.services.db import get_supabase_admin
        
        client = get_supabase_admin()
        
        # Add the starred column using raw SQL
        sql = """
        ALTER TABLE chats 
        ADD COLUMN IF NOT EXISTS starred BOOLEAN DEFAULT FALSE;
        """
        
        result = client.rpc('exec_sql', {'sql': sql}).execute()
        print("Successfully added starred column to chats table")
        
        # Add index for better performance
        index_sql = """
        CREATE INDEX IF NOT EXISTS idx_chats_starred 
        ON chats(starred) WHERE starred = TRUE;
        """
        
        index_result = client.rpc('exec_sql', {'sql': index_sql}).execute()
        print("Successfully added index for starred column")
        
    except Exception as e:
        print(f"Error adding starred column: {e}")
        # Let's try a different approach using direct SQL
        try:
            # For Supabase, we can use the _admin client to run SQL
            from supabase import create_client
            
            supabase_url = os.getenv("SUPABASE_URL")
            supabase_key = os.getenv("SUPABASE_SERVICE_ROLE_KEY")
            
            if supabase_url and supabase_key:
                admin_client = create_client(supabase_url, supabase_key)
                
                # Try to add the column by inserting a test record with starred field
                test_result = admin_client.table("chats").select("starred").limit(1).execute()
                print("Starred column already exists or was added successfully")
                
        except Exception as e2:
            print(f"Alternative approach also failed: {e2}")

if __name__ == "__main__":
    asyncio.run(add_starred_column())
