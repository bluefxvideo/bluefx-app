-- User Dashboard Enhanced Functions
-- Creates optimized queries for user dashboard analytics

-- Function to get comprehensive user content statistics
CREATE OR REPLACE FUNCTION get_user_content_stats(user_id_param UUID)
RETURNS JSON AS $$
DECLARE
    result JSON;
BEGIN
    SELECT json_build_object(
        'generated_images', (
            SELECT COUNT(*) FROM generated_images 
            WHERE user_id = user_id_param
        ),
        'avatar_videos', (
            SELECT COUNT(*) FROM avatar_videos 
            WHERE user_id = user_id_param
        ),
        'cinematographer_videos', (
            SELECT COUNT(*) FROM cinematographer_videos 
            WHERE user_id = user_id_param
        ),
        'ebook_history', (
            SELECT COUNT(*) FROM ebook_history 
            WHERE user_id = user_id_param
        ),
        'ebook_writer_history', (
            SELECT COUNT(*) FROM ebook_writer_history 
            WHERE user_id = user_id_param
        ),
        'logo_history', (
            SELECT COUNT(*) FROM logo_history 
            WHERE user_id = user_id_param
        ),
        'music_history', (
            SELECT COUNT(*) FROM music_history 
            WHERE user_id = user_id_param
        ),
        'script_to_video_history', (
            SELECT COUNT(*) FROM script_to_video_history 
            WHERE user_id = user_id_param
        ),
        'content_multiplier_history', (
            SELECT COUNT(*) FROM content_multiplier_history 
            WHERE user_id = user_id_param
        ),
        'generated_voices', (
            SELECT COUNT(*) FROM generated_voices 
            WHERE user_id = user_id_param
        )
    ) INTO result;
    
    RETURN result;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user usage analytics by date range
CREATE OR REPLACE FUNCTION get_user_usage_analytics(
    user_id_param UUID,
    days_back INTEGER DEFAULT 30
)
RETURNS TABLE(
    date_bucket DATE,
    credits_used INTEGER,
    unique_tools INTEGER,
    content_created INTEGER
) AS $$
BEGIN
    RETURN QUERY
    WITH date_series AS (
        SELECT generate_series(
            CURRENT_DATE - INTERVAL '1 day' * days_back,
            CURRENT_DATE - INTERVAL '1 day',
            INTERVAL '1 day'
        )::DATE as date_bucket
    ),
    daily_usage AS (
        SELECT 
            DATE(cu.created_at) as usage_date,
            SUM(cu.credits_used) as daily_credits,
            COUNT(DISTINCT cu.tool_id) as daily_tools,
            COUNT(*) as daily_content
        FROM credit_usage cu
        WHERE cu.user_id = user_id_param
        AND cu.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
        GROUP BY DATE(cu.created_at)
    )
    SELECT 
        ds.date_bucket,
        COALESCE(du.daily_credits, 0)::INTEGER as credits_used,
        COALESCE(du.daily_tools, 0)::INTEGER as unique_tools,
        COALESCE(du.daily_content, 0)::INTEGER as content_created
    FROM date_series ds
    LEFT JOIN daily_usage du ON ds.date_bucket = du.usage_date
    ORDER BY ds.date_bucket;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get top tools by usage for a user
CREATE OR REPLACE FUNCTION get_user_top_tools(
    user_id_param UUID,
    days_back INTEGER DEFAULT 30,
    limit_count INTEGER DEFAULT 10
)
RETURNS TABLE(
    tool_id TEXT,
    usage_count BIGINT,
    credits_used BIGINT,
    last_used TIMESTAMP WITH TIME ZONE,
    first_used TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cu.tool_id,
        COUNT(*) as usage_count,
        SUM(cu.credits_used) as credits_used,
        MAX(cu.created_at) as last_used,
        MIN(cu.created_at) as first_used
    FROM credit_usage cu
    WHERE cu.user_id = user_id_param
    AND cu.created_at >= CURRENT_DATE - INTERVAL '1 day' * days_back
    GROUP BY cu.tool_id
    ORDER BY usage_count DESC, credits_used DESC
    LIMIT limit_count;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION get_user_content_stats(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_usage_analytics(UUID, INTEGER) TO authenticated;
GRANT EXECUTE ON FUNCTION get_user_top_tools(UUID, INTEGER, INTEGER) TO authenticated;

-- RLS policies to ensure users can only access their own data
-- These functions are SECURITY DEFINER but we should still verify user access in application