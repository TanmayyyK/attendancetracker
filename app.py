import streamlit as st
import sqlite3
import pandas as pd
import io
from datetime import datetime
from github import Github # Library to talk to GitHub
import os

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
CSV_FILE = "attendance_log.csv"
TARGET_ATTENDANCE = 75

# -------------------------------------------------
# 2. CUSTOM CSS
# -------------------------------------------------
st.markdown("""
<style>
    @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;700&display=swap');
    .stApp { background: linear-gradient(135deg, #fdfbfb 0%, #ebedee 100%); background-attachment: fixed; font-family: 'Outfit', sans-serif; }
    h1, h2, h3, p, div, span, label, li { color: #4a4a4a; }
    .block-container { padding-top: 2rem; padding-bottom: 5rem; }
    .glass-card { background: rgba(255, 255, 255, 0.65); backdrop-filter: blur(12px); -webkit-backdrop-filter: blur(12px); border-radius: 24px; border: 1px solid rgba(255, 255, 255, 0.5); box-shadow: 0 4px 20px rgba(0,0,0,0.03); padding: 20px; transition: transform 0.2s ease; }
    .glass-card:hover { transform: translateY(-3px); box-shadow: 0 10px 25px rgba(108, 92, 231, 0.1); background: rgba(255, 255, 255, 0.85); }
    .metric-label { font-size: 0.85rem; font-weight: 500; color: #718093; text-transform: uppercase; letter-spacing: 1px; }
    .metric-value { font-size: 2.2rem; font-weight: 700; color: #2f3640; }
    .prof-name { font-size: 1.1rem; font-weight: 600; color: #2f3640; }
    .status-badge { padding: 5px 12px; border-radius: 15px; font-size: 0.8rem; font-weight: 600; }
    .progress-bg { width: 100%; background-color: #dcdde1; border-radius: 10px; height: 10px; margin: 12px 0; overflow: hidden; }
    .progress-fill { height: 100%; border-radius: 10px; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1); }
    div[data-testid="stNumberInput"] { border-radius: 12px; overflow: hidden; }
    div[data-testid="stNumberInput"] input { color: #2f3640; text-align: center; font-weight: 600; background-color: rgba(255,255,255,0.7); border: 1px solid #dcdde1; }
    div[data-testid="stNumberInput"] button { background-color: rgba(255,255,255,0.5); }
    button[kind="primary"] { background: linear-gradient(135deg, #a55eea 0%, #8854d0 100%); border: none; color: white !important; font-weight: 600; border-radius: 12px; transition: opacity 0.3s; }
    button[kind="primary"]:hover { opacity: 0.9; box-shadow: 0 4px 15px rgba(136, 84, 208, 0.3); }
    div[data-testid="stDownloadButton"] button { width: 100%; border: 1px solid #a55eea; color: #a55eea; background: white; border-radius: 12px; font-weight: 600; }
    div[data-testid="stDownloadButton"] button:hover { background: #a55eea; color: white; }
</style>
""", unsafe_allow_html=True)

# -------------------------------------------------
# 3. BACKEND & GITHUB SYNC LOGIC
# -------------------------------------------------

def get_data():
    conn = sqlite3.connect(DB_FILE)
    try:
        df = pd.read_sql("SELECT * FROM attendance", conn)
    except:
        df = pd.DataFrame()
    conn.close()
    return df

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
    
    # --- AUTO-RESTORE LOGIC ---
    # If DB is empty, check if we have a CSV backup locally or in repo
    c.execute("SELECT count(*) FROM attendance")
    if c.fetchone()[0] == 0:
        if os.path.exists(CSV_FILE):
            try:
                # Load CSV into DB
                df = pd.read_csv(CSV_FILE)
                df.to_sql('attendance', conn, if_exists='append', index=False)
                print("✅ Data Restored from CSV Backup")
            except Exception as e:
                print(f"Restore failed: {e}")
    
    conn.commit()
    conn.close()

def push_to_github_backup():
    """
    Takes the current database, converts to CSV, and pushes to GitHub.
    """
    try:
        # 1. Get current data
        df = get_data()
        csv_content = df.to_csv(index=False)
        
        # 2. Authenticate
        if "GITHUB_TOKEN" in st.secrets:
            g = Github(st.secrets["GITHUB_TOKEN"])
            repo = g.get_repo(st.secrets["REPO_NAME"])
            
            # 3. Try to get file, create if missing, update if exists
            try:
                contents = repo.get_contents(CSV_FILE)
                # Update existing file
                repo.update_file(CSV_FILE, "Auto-Update Attendance [skip ci]", csv_content, contents.sha)
                st.toast("✅ Cloud Backup Updated!", icon="☁️")
            except:
                # Create new file
                repo.create_file(CSV_FILE, "Initial Attendance Backup [skip ci]", csv_content)
                st.toast("✅ Cloud Backup Created!", icon="☁️")
                
            # 4. Also update local CSV so we don't need to pull next time
            df.to_csv(CSV_FILE, index=False)
            
    except Exception as e:
        st.error(f"GitHub Sync Failed: {e}")

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
    
    # --- TRIGGER GITHUB SYNC ---
    if count > 0:
        push_to_github_backup()
        
    return count

def to_excel(df):
    output = io.BytesIO()
    with pd.ExcelWriter(output, engine='openpyxl') as writer:
        df.to_excel(writer, index=False, sheet_name='Daily Logs')
        summary_data = []
        for prof in PROFESSORS:
            prof_df = df[df['professor'] == prof]
            total = len(prof_df)
            present = len(prof_df[prof_df['status'] == 'Present'])
            absent = len(prof_df[prof_df['status'] == 'Absent'])
            pct = round((present / total) * 100, 1) if total > 0 else 0
            summary_data.append({"Professor": prof, "Total": total, "Attended": present, "Missed": absent, "%": f"{pct}%"})
        pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name='Summary')
    return output.getvalue()

def calculate_status(present, total):
    if total == 0: return 0, "No data", "neutral", "#b2bec3"
    pct = (present / total) * 100
    bunkable = int((present / 0.75) - total)
    needed = int(3 * total - 4 * present)
    if pct >= TARGET_ATTENDANCE: return pct, f"Safe to bunk <b>{bunkable}</b>", "good", "#8854d0"
    needed = max(needed, 0)
    return pct, f"Attend next <b>{needed}</b>", "bad", "#ff7675"

# Initialize App
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

with tab_dash:
    df = get_data()
    if df.empty:
        st.markdown("<div class='glass-card' style='text-align:center; padding:40px;'><h3>👋 Welcome!</h3><p>Your journey starts here. Go to 'Log Data' to add your first entry.</p></div>", unsafe_allow_html=True)
    else:
        total = len(df)
        present = len(df[df['status'] == 'Present'])
        absent = total - present
        pct = round((present / total) * 100, 1)
        m1, m2, m3, m4 = st.columns(4)
        def metric(c, l, v, col="#2f3640"): 
            c.markdown(f"<div class='glass-card' style='padding:15px; text-align:center;'><div class='metric-label'>{l}</div><div class='metric-value' style='color:{col}'>{v}</div></div>", unsafe_allow_html=True)
        metric(m1, "Attendance", f"{pct}%", "#8854d0" if pct >= 75 else "#ff7675")
        metric(m2, "Total Classes", total)
        metric(m3, "Present", present, "#26de81")
        metric(m4, "Missed", absent, "#ff7675")
        
        st.write("")
        h1, h2 = st.columns([3, 1])
        h1.subheader("Subject Performance")
        try:
            h2.download_button("📥 Download Excel", data=to_excel(df), file_name=f'Attendance_{datetime.now().date()}.xlsx', mime='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', use_container_width=True)
        except: h2.error("Install openpyxl")

        cols = st.columns(3)
        for i, prof in enumerate(PROFESSORS):
            d = df[df["professor"] == prof]
            p, t = len(d[d["status"]=="Present"]), len(d)
            pt, msg, stt, col = calculate_status(p, t)
            cols[i%3].markdown(f"""
            <div class="glass-card" style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                    <span class="prof-name">{prof}</span><span class="status-badge" style="background:{col}15; color:{col};">{pt:.0f}%</span>
                </div>
                <div class="progress-bg"><div class="progress-fill" style="width:{pt}%; background:linear-gradient(90deg, {col}, {col}aa);"></div></div>
                <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:#718093;"><span>{p}/{t} Lectures</span><span style="color:{col}; font-weight:600;">{msg}</span></div>
            </div>""", unsafe_allow_html=True)

with tab_log:
    st.subheader("Daily Entry")
    with st.form("log"):
        data = {}
        cols = st.columns(3)
        for i, prof in enumerate(PROFESSORS):
            with cols[i%3].container():
                st.markdown(f"<div class='glass-card' style='margin-bottom:15px; border-left:4px solid #a55eea;'><div style='font-weight:600; color:#2f3640;'>{prof}</div>", unsafe_allow_html=True)
                c1, c2 = st.columns(2)
                p = c1.number_input("P", 0, 5, key=f"p{i}", label_visibility="collapsed")
                a = c2.number_input("A", 0, 5, key=f"a{i}", label_visibility="collapsed")
                c1.caption("✅ Present"); c2.caption("❌ Absent")
                st.markdown("</div>", unsafe_allow_html=True)
                data[prof] = {"present": p, "absent": a}
        if st.form_submit_button("💾 Save & Sync", type="primary", use_container_width=True):
            if save_attendance(data) > 0: st.rerun()
            else: st.warning("Enter at least one lecture.")
