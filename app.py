import streamlit as st
import sqlite3
import pandas as pd
import io
from datetime import datetime

# -------------------------------------------------
# 1. CONFIGURATION
# -------------------------------------------------
st.set_page_config(
    page_title="Attendance Tanya",
    page_icon="🔮",
    layout="wide",
    initial_sidebar_state="collapsed"
)

# --- USER DATA & SETTINGS ---
PROFESSORS = [
    "Satish Sir (Dean)", "Raghu Sir", "Tanvi Mam",
    "Akanksha Mam", "Dhaval Sir", "Ritesh Mam",
    "Anoop Sir", "CM Sir", "Viren Sir"
]
DB_FILE = "attendance_ultra.db"
TARGET_ATTENDANCE = 75

# -------------------------------------------------
# 2. CUSTOM CSS (Lavender & Grey Theme)
# -------------------------------------------------
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700&display=swap');

    /* --- MAIN THEME --- */
    .stApp {
        background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); 
        background-attachment: fixed;
        font-family: 'Outfit', sans-serif;
    }
    
    /* Global Text Color */
    h1, h2, h3, p, div, span, label, li {
        color: #4a4a4a;
    }
    
    .block-container {
        padding-top: 2rem;
        padding-bottom: 5rem;
    }

    /* --- GLASS CARDS --- */
    .glass-card {
        background: rgba(255, 255, 255, 0.65);
        backdrop-filter: blur(12px);
        -webkit-backdrop-filter: blur(12px);
        border-radius: 24px;
        border: 1px solid rgba(255, 255, 255, 0.5);
        box-shadow: 0 4px 20px rgba(0,0,0,0.03);
        padding: 20px;
        transition: transform 0.2s ease;
    }
    
    .glass-card:hover {
        transform: translateY(-3px);
        box-shadow: 0 10px 25px rgba(108, 92, 231, 0.1);
        background: rgba(255, 255, 255, 0.85);
    }

    /* --- METRICS --- */
    .metric-label {
        font-size: 0.85rem;
        font-weight: 500;
        color: #718093;
        text-transform: uppercase;
        letter-spacing: 1px;
    }
    
    .metric-value {
        font-size: 2.2rem;
        font-weight: 700;
        color: #2f3640;
    }

    /* --- SUBJECT CARDS --- */
    .prof-name {
        font-size: 1.1rem;
        font-weight: 600;
        color: #2f3640;
    }
    
    .status-badge {
        padding: 5px 12px;
        border-radius: 15px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    /* --- PROGRESS BARS --- */
    .progress-bg {
        width: 100%;
        background-color: #dcdde1;
        border-radius: 10px;
        height: 10px;
        margin: 12px 0;
        overflow: hidden;
    }
    
    .progress-fill {
        height: 100%;
        border-radius: 10px;
        transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* --- INPUTS --- */
    div[data-testid="stNumberInput"] {
        border-radius: 12px;
        overflow: hidden;
    }
    div[data-testid="stNumberInput"] input {
        color: #2f3640;
        text-align: center;
        font-weight: 600;
        background-color: rgba(255,255,255,0.7);
        border: 1px solid #dcdde1;
    }
    div[data-testid="stNumberInput"] button {
        background-color: rgba(255,255,255,0.5);
    }

    /* --- BUTTONS --- */
    button[kind="primary"] {
        background: linear-gradient(135deg, #a55eea 0%, #8854d0 100%);
        border: none;
        color: white !important;
        font-weight: 600;
        border-radius: 12px;
        transition: opacity 0.3s;
    }
    button[kind="primary"]:hover {
        opacity: 0.9;
        box-shadow: 0 4px 15px rgba(136, 84, 208, 0.3);
    }
    
    /* Download Button Style */
    div[data-testid="stDownloadButton"] button {
        width: 100%;
        border: 1px solid #a55eea;
        color: #a55eea;
        background: white;
        border-radius: 12px;
        font-weight: 600;
    }
    div[data-testid="stDownloadButton"] button:hover {
        background: #a55eea;
        color: white;
    }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------
# 3. BACKEND LOGIC
# -------------------------------------------------
def init_db():
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    c.execute("""
        CREATE TABLE IF NOT EXISTS attendance (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            date TEXT,
            timestamp TEXT,
            professor TEXT,
            status TEXT
        )
    """)
    try:
        c.execute("UPDATE attendance SET professor = 'Viren Sir' WHERE professor = 'Mahesh Sir'")
    except:
        pass
    conn.commit()
    conn.close()

def save_attendance(data_dict):
    conn = sqlite3.connect(DB_FILE)
    c = conn.cursor()
    today = str(datetime.now().date())
    now = datetime.now().strftime("%H:%M:%S")
    count = 0
    
    for prof, counts in data_dict.items():
        for _ in range(counts['present']):
            c.execute("INSERT INTO attendance VALUES (NULL, ?, ?, ?, ?)", (today, now, prof, "Present"))
            count += 1
        for _ in range(counts['absent']):
            c.execute("INSERT INTO attendance VALUES (NULL, ?, ?, ?, ?)", (today, now, prof, "Absent"))
            count += 1
            
    conn.commit()
    conn.close()
    return count

def get_data():
    conn = sqlite3.connect(DB_FILE)
    df = pd.read_sql("SELECT * FROM attendance", conn)
    conn.close()
    return df

# --- MODIFIED EXCEL EXPORT FUNCTION ---
def to_excel(df):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        # Sheet 1: Detailed Logs (Existing)
        df.to_excel(writer, index=False, sheet_name='Daily Logs')

        # Sheet 2: Summary Dashboard (New)
        summary_data = []
        for prof in PROFESSORS:
            # Filter data for this specific professor
            prof_df = df[df['professor'] == prof]
            
            total = len(prof_df)
            present = len(prof_df[prof_df['status'] == 'Present'])
            absent = len(prof_df[prof_df['status'] == 'Absent'])
            
            # Calculate Percentage safely
            if total > 0:
                pct = round((present / total) * 100, 1)
            else:
                pct = 0
                
            summary_data.append({
                "Professor": prof,
                "Total Classes": total,
                "Attended": present,
                "Missed": absent,
                "Attendance %": f"{pct}%"
            })
            
        summary_df = pd.DataFrame(summary_data)
        summary_df.to_excel(writer, index=False, sheet_name='Summary Dashboard')

    processed_data = output.getvalue()
    return processed_data

def calculate_status(present, total):
    if total == 0:
        return 0, "No data", "neutral", "#b2bec3"
    
    pct = (present / total) * 100
    bunkable = int((present / 0.75) - total)
    needed = int(3 * total - 4 * present)
    
    if pct >= TARGET_ATTENDANCE:
        msg = f"Safe to bunk <b>{bunkable}</b>"
        color = "#8854d0"  # Lavender/Purple
        status = "good"
    else:
        needed = max(needed, 0)
        msg = f"Attend next <b>{needed}</b>"
        color = "#ff7675"  # Soft Red
        status = "bad"
        
    return pct, msg, status, color

init_db()

# -------------------------------------------------
# 4. APP LAYOUT
# -------------------------------------------------

c1, c2 = st.columns([3, 1])
with c1:
    st.title("Attendance")
    st.markdown(f"<span style='color:#a55eea; font-weight:600;'>{datetime.now().strftime('%A, %d %B %Y')}</span>", unsafe_allow_html=True)

st.markdown("<div style='height: 20px'></div>", unsafe_allow_html=True)

tab_dash, tab_log = st.tabs(["📊 Dashboard", "✍️ Log Data"])

# =================================================
# TAB 1: DASHBOARD
# =================================================
with tab_dash:
    df = get_data()
    
    if df.empty:
        st.markdown("""
        <div class="glass-card" style="text-align:center; padding:40px;">
            <h3>👋 Welcome!</h3>
            <p>Your journey starts here. Go to 'Log Data' to add your first entry.</p>
        </div>
        """, unsafe_allow_html=True)
    else:
        # --- Metrics ---
        total_classes = len(df)
        present_count = len(df[df['status'] == 'Present'])
        absent_count = total_classes - present_count
        overall_pct = round((present_count / total_classes) * 100, 1)

        m1, m2, m3, m4 = st.columns(4)
        
        def draw_metric(col, label, value, color="#2f3640"):
            with col:
                st.markdown(f"""
                <div class="glass-card" style="padding: 15px; margin-bottom: 10px; text-align:center;">
                    <div class="metric-label">{label}</div>
                    <div class="metric-value" style="color:{color}">{value}</div>
                </div>
                """, unsafe_allow_html=True)

        draw_metric(m1, "Attendance", f"{overall_pct}%", "#8854d0" if overall_pct >= 75 else "#ff7675")
        draw_metric(m2, "Total Classes", total_classes)
        draw_metric(m3, "Present", present_count, "#26de81")
        draw_metric(m4, "Missed", absent_count, "#ff7675")

        st.markdown("<br>", unsafe_allow_html=True)
        
        # --- HEADER + DOWNLOAD BUTTON ---
        h_col1, h_col2 = st.columns([3, 1])
        with h_col1:
            st.subheader("Subject Performance")
        with h_col2:
            try:
                excel_data = to_excel(df)
                st.download_button(
                    label="📥 Download Excel",
                    data=excel_data,
                    file_name=f'Attendance_Summary_{datetime.now().date()}.xlsx',
                    mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                    use_container_width=True
                )
            except Exception as e:
                st.error(f"Excel Error: {e}")
        
        # --- Subject Cards ---
        subj_cols = st.columns(3)
        
        for i, prof in enumerate(PROFESSORS):
            prof_data = df[df["professor"] == prof]
            p_total = len(prof_data)
            p_present = len(prof_data[prof_data["status"] == "Present"])
            
            pct, msg, status, color = calculate_status(p_present, p_total)
            badge_bg = f"{color}15"
            
            with subj_cols[i % 3]:
                # HTML Card with Correct Formatting
                card_html = f"""<div class="glass-card" style="margin-bottom: 20px;">
<div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
<span class="prof-name">{prof}</span>
<span class="status-badge" style="background:{badge_bg}; color:{color};">{pct:.0f}%</span>
</div>
<div class="progress-bg">
<div class="progress-fill" style="width: {pct}%; background: linear-gradient(90deg, {color}, {color}aa);"></div>
</div>
<div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#718093;">
<span>{p_present}/{p_total} Lectures</span>
<span style="color:{color}; font-weight:600;">{msg}</span>
</div>
</div>"""
                st.markdown(card_html, unsafe_allow_html=True)

# =================================================
# TAB 2: LOGGING
# =================================================
with tab_log:
    st.subheader("Daily Entry")
    
    with st.form("log_form", clear_on_submit=True):
        input_data = {}
        cols = st.columns(3)
        
        for i, prof in enumerate(PROFESSORS):
            with cols[i % 3]:
                with st.container():
                    st.markdown(f"""
                    <div class="glass-card" style="margin-bottom:15px; border-left: 4px solid #a55eea;">
                        <div style="font-weight:600; color:#2f3640; margin-bottom:8px;">{prof}</div>
                    """, unsafe_allow_html=True)
                    
                    c_p, c_a = st.columns(2)
                    with c_p:
                        p = st.number_input("Present", min_value=0, max_value=5, key=f"p_{i}", label_visibility="collapsed")
                        st.caption("✅ Present")
                    with c_a:
                        a = st.number_input("Absent", min_value=0, max_value=5, key=f"a_{i}", label_visibility="collapsed")
                        st.caption("❌ Absent")
                    
                    st.markdown("</div>", unsafe_allow_html=True)
                    input_data[prof] = {"present": p, "absent": a}

        st.markdown("<br>", unsafe_allow_html=True)
        
        btn_c1, btn_c2, btn_c3 = st.columns([1, 2, 1])
        with btn_c2:
            submit_btn = st.form_submit_button("💾 Save to Database", type="primary", use_container_width=True)

        if submit_btn:
            count = save_attendance(input_data)
            if count > 0:
                st.toast(f"Saved {count} records!", icon="🟣")
                st.balloons()
                import time
                time.sleep(1)
                st.rerun()
            else:
                st.warning("Please enter at least one lecture.")