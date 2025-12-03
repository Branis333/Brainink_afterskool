# """
# Comprehensive Database Fix for NULL Value Validation Errors
# This script addresses the Pydantic validation errors by fixing NULL values in the database
# """

# import os
# import sys
# from sqlalchemy import create_engine, text
# from sqlalchemy.orm import sessionmaker
# from datetime import datetime

# def comprehensive_database_fix():
#     """Comprehensive fix for all database validation issues"""
#     print("🚀 Starting comprehensive database fix...")
    
#     # Database connection
#     DATABASE_URL = os.getenv(
#         "DATABASE_URL", 
#         "postgresql://postgres:password@localhost:5432/brainink"
#     )
    
#     if not DATABASE_URL:
#         print("❌ ERROR: DATABASE_URL environment variable is not set!")
#         return False
    
#     try:
#         engine = create_engine(DATABASE_URL)
#         SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
#     except Exception as e:
#         print(f"❌ Database connection failed: {str(e)}")
#         return False
    
#     session = SessionLocal()
#     try:
#         # First, let's check the current state
#         print("\n📊 Analyzing current database state...")
        
#         # Check courses table
#         try:
#             result = session.execute(text("""
#                 SELECT 
#                     COUNT(*) as total_courses,
#                     SUM(CASE WHEN total_weeks IS NULL THEN 1 ELSE 0 END) as null_total_weeks,
#                     SUM(CASE WHEN blocks_per_week IS NULL THEN 1 ELSE 0 END) as null_blocks_per_week,
#                     SUM(CASE WHEN generated_by_ai IS NULL THEN 1 ELSE 0 END) as null_generated_by_ai
#                 FROM as_courses
#             """))
            
#             stats = result.fetchone()
#             print(f"📋 Courses Analysis:")
#             print(f"   - Total Courses: {stats[0]}")
#             print(f"   - NULL total_weeks: {stats[1]}")
#             print(f"   - NULL blocks_per_week: {stats[2]}")
#             print(f"   - NULL generated_by_ai: {stats[3]}")
            
#             # Fix NULL values in courses
#             print("\n🔧 Fixing NULL values in as_courses...")
            
#             # Update total_weeks
#             if stats[1] > 0:
#                 result = session.execute(text("""
#                     UPDATE as_courses 
#                     SET total_weeks = COALESCE(total_weeks, 8)
#                     WHERE total_weeks IS NULL
#                 """))
#                 print(f"✅ Fixed {result.rowcount} NULL total_weeks values")
            
#             # Update blocks_per_week
#             if stats[2] > 0:
#                 result = session.execute(text("""
#                     UPDATE as_courses 
#                     SET blocks_per_week = COALESCE(blocks_per_week, 2)
#                     WHERE blocks_per_week IS NULL
#                 """))
#                 print(f"✅ Fixed {result.rowcount} NULL blocks_per_week values")
            
#             # Update generated_by_ai
#             if stats[3] > 0:
#                 result = session.execute(text("""
#                     UPDATE as_courses 
#                     SET generated_by_ai = COALESCE(generated_by_ai, FALSE)
#                     WHERE generated_by_ai IS NULL
#                 """))
#                 print(f"✅ Fixed {result.rowcount} NULL generated_by_ai values")
            
#             # Set constraints to prevent future NULL values
#             print("\n🛡️ Setting database constraints...")
            
#             try:
#                 session.execute(text("""
#                     ALTER TABLE as_courses 
#                     ALTER COLUMN total_weeks SET NOT NULL,
#                     ALTER COLUMN total_weeks SET DEFAULT 8
#                 """))
#                 print("✅ Set total_weeks as NOT NULL with default 8")
#             except Exception as e:
#                 print(f"⚠️ total_weeks constraint: {str(e)}")
            
#             try:
#                 session.execute(text("""
#                     ALTER TABLE as_courses 
#                     ALTER COLUMN blocks_per_week SET NOT NULL,
#                     ALTER COLUMN blocks_per_week SET DEFAULT 2
#                 """))
#                 print("✅ Set blocks_per_week as NOT NULL with default 2")
#             except Exception as e:
#                 print(f"⚠️ blocks_per_week constraint: {str(e)}")
            
#             try:
#                 session.execute(text("""
#                     ALTER TABLE as_courses 
#                     ALTER COLUMN generated_by_ai SET NOT NULL,
#                     ALTER COLUMN generated_by_ai SET DEFAULT FALSE
#                 """))
#                 print("✅ Set generated_by_ai as NOT NULL with default FALSE")
#             except Exception as e:
#                 print(f"⚠️ generated_by_ai constraint: {str(e)}")
            
#         except Exception as e:
#             print(f"❌ Error analyzing/fixing courses table: {str(e)}")
#             return False
        
#         # Commit all changes
#         session.commit()
        
#         # Final verification
#         print("\n✅ Final verification:")
#         result = session.execute(text("""
#             SELECT 
#                 COUNT(*) as total_courses,
#                 SUM(CASE WHEN total_weeks IS NULL THEN 1 ELSE 0 END) as null_total_weeks,
#                 SUM(CASE WHEN blocks_per_week IS NULL THEN 1 ELSE 0 END) as null_blocks_per_week,
#                 SUM(CASE WHEN generated_by_ai IS NULL THEN 1 ELSE 0 END) as null_generated_by_ai
#             FROM as_courses
#         """))
        
#         final_stats = result.fetchone()
#         print(f"📊 After Fix:")
#         print(f"   - Total Courses: {final_stats[0]}")
#         print(f"   - NULL total_weeks: {final_stats[1]}")
#         print(f"   - NULL blocks_per_week: {final_stats[2]}")
#         print(f"   - NULL generated_by_ai: {final_stats[3]}")
        
#         if final_stats[1] == 0 and final_stats[2] == 0 and final_stats[3] == 0:
#             print("🎉 All NULL values successfully eliminated!")
#             return True
#         else:
#             print("⚠️ Some NULL values still remain")
#             return False
            
#     except Exception as e:
#         print(f"❌ Comprehensive fix failed: {str(e)}")
#         session.rollback()
#         return False
#     finally:
#         session.close()

# if __name__ == "__main__":
#     success = comprehensive_database_fix()
#     if success:
#         print("\n🎉 Database fix completed successfully!")
#         sys.exit(0)
#     else:
#         print("\n❌ Database fix failed!")
#         sys.exit(1)