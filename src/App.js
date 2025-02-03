import { useState, useEffect, useRef } from "react";
import "./App.css";

// Import data from json file
const { fileContents, fileSystem } = require("./data.json");

const JsonView = ({ data, level = 0 }) => {
    const indent = level * 20;

    // Move all useState hooks to the top level
    const [expandedKeys, setExpandedKeys] = useState(() => {
        // Initialize all keys as expanded by default
        const keys = new Set();
        const initializeKeys = (obj, prefix = "") => {
            if (typeof obj !== "object" || obj === null) return;
            Object.keys(obj).forEach(key => {
                const fullKey = prefix ? `${prefix}.${key}` : key;
                keys.add(fullKey);
                if (typeof obj[key] === "object" && obj[key] !== null) {
                    initializeKeys(obj[key], fullKey);
                }
            });
        };
        initializeKeys(data);
        return keys;
    });

    const toggleExpand = key => {
        setExpandedKeys(prev => {
            const next = new Set(prev);
            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
            }
            return next;
        });
    };

    const isExpanded = key => expandedKeys.has(key);

    const renderValue = (value, path) => {
        if (Array.isArray(value)) {
            return (
                <div className="json-array-wrapper">
                    <span className="json-bracket">[</span>
                    {isExpanded(path) && (
                        <div className="json-array" style={{ marginLeft: "20px" }}>
                            {value.map((item, index) => (
                                <div key={index} className="json-array-item">
                                    {typeof item === "object" && item !== null ? (
                                        <JsonView data={item} level={level + 1} />
                                    ) : (
                                        <>
                                            <span className="json-value">
                                                {typeof item === "string" ? `"${item}"` : String(item)}
                                            </span>
                                            {index < value.length - 1 && <span className="json-comma">,</span>}
                                        </>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                    <span className="json-bracket">]</span>
                </div>
            );
        }
        if (typeof value === "object" && value !== null) {
            return (
                <div className="json-content" style={{ marginLeft: indent }}>
                    <span className="json-brace">{"{"}</span>
                    {isExpanded(path) && (
                        <div className="json-body">
                            {Object.entries(value).map(([key, val], index, array) => (
                                <div key={key} className="json-line">
                                    <span className="json-key">"{key}"</span>
                                    <span className="json-colon">:</span>
                                    {renderValue(val, `${path}.${key}`)}
                                    {index < array.length - 1 && <span className="json-comma">,</span>}
                                </div>
                            ))}
                        </div>
                    )}
                    <span className="json-brace">{"}"}</span>
                </div>
            );
        }
        return (
            <span className={`json-value ${typeof value}`}>
                {typeof value === "string" ? `"${value}"` : String(value)}
            </span>
        );
    };

    return (
        <div className="json-content" style={{ marginLeft: indent }}>
            <span className="json-brace">{"{"}</span>
            <div className="json-body">
                {Object.entries(data).map(([key, value], index, array) => (
                    <div key={key} className="json-line">
                        {typeof value === "object" && value !== null && (
                            <span
                                className="expand-toggle"
                                onClick={e => {
                                    e.stopPropagation();
                                    toggleExpand(key);
                                }}
                            >
                                {isExpanded(key) ? "−" : "+"}
                            </span>
                        )}
                        <span className="json-key">"{key}"</span>
                        <span className="json-colon">:</span>
                        {renderValue(value, key)}
                        {index < array.length - 1 && <span className="json-comma">,</span>}
                    </div>
                ))}
            </div>
            <span className="json-brace">{"}"}</span>
        </div>
    );
};

// Terminal component to handle commands
function Terminal({ onPowerOff }) {
    const [history, setHistory] = useState([
        { text: 'Welcome to my Portfolio! Type "help" for available commands.', type: "system" },
        { text: '💡 TIP: Use the "Tab" key for command/path auto-completion', type: "tip" },
        { text: "💡 TIP: Use Up/Down arrow keys to navigate through command history", type: "tip" }
    ]);
    const [currentPath, setCurrentPath] = useState("~yashbhati");
    const [inputValue, setInputValue] = useState("");
    const inputRef = useRef(null);
    const historyRef = useRef(null);
    const [openFile, setOpenFile] = useState(null);
    const [isClosing, setIsClosing] = useState(false);
    const [suggestions, setSuggestions] = useState([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [tabIndex, setTabIndex] = useState(-1);
    const [commandHistory, setCommandHistory] = useState([]);
    const [historyIndex, setHistoryIndex] = useState(-1);
    const [tempInput, setTempInput] = useState("");
    const [isHacking, setIsHacking] = useState(false);
    const [hackComplete, setHackComplete] = useState(false);

    const commands = {
        banner: () => ({
            output: `
__   __    _    ____  _   _   ____  _   _    _  _____ ___
\\ \\ / /   / \\  / ___|| | | | | __ )| | | |  / \\|_   _|_ _|
 \\ V /   / _ \\ \\___ \\| |_| | |  _ \\| |_| | / _ \\ | |  | |
  | |   / ___ \\ ___) |  _  | | |_) |  _  |/ ___ \\| |  | |
  |_|  /_/   \\_\\____/|_| |_| |____/|_| |_/_/   \\_\\_| |___|
`,
            type: "success"
        }),
        help: () => ({
            output: `Available commands:
            ls - List directory contents
            cd [dir] - Change directory
            cd .. - Go back to the previous directory
            cat [file] - View file contents
            pwd - Print working directory
            clear - Clear terminal
            sleep - Shutdown the system
            banner - Display ASCII art banner
            help - Show this help message
            hack - Initiate hacker mode`,
            type: "success"
        }),
        ls: () => ({
            output: fileSystem[currentPath]?.content.join("    ") || "Empty directory",
            type: "success"
        }),
        pwd: () => ({
            output: currentPath,
            type: "success"
        }),
        clear: () => {
            setHistory([
                {
                    text: 'Welcome to my Portfolio! Type "help" for available commands.',
                    type: "system"
                }
            ]);
            return { output: "", type: "clear" };
        },
        cd: args => {
            if (args === "~" || args === "~yashbhati") {
                setCurrentPath("~yashbhati");
                return { output: "", type: "success" };
            }

            const newPath =
                args === ".."
                    ? currentPath === "~yashbhati"
                        ? "~yashbhati"
                        : currentPath.split("/").slice(0, -1).join("/") || "~yashbhati"
                    : `${currentPath}/${args}`.replace(/\/+/g, "/");

            if (fileSystem[newPath]) {
                setCurrentPath(newPath);
                return { output: "", type: "success" };
            }
            return { output: "Directory not found", type: "error" };
        },
        cat: args => {
            const fileName = args;
            if (fileContents[fileName]) {
                const content = fileContents[fileName].content;
                const isJSON = fileName.endsWith(".json");

                // If it's already an object (from data.json), use it directly
                // If it's a string, try to parse it
                const parsedContent = isJSON ? (typeof content === "object" ? content : JSON.parse(content)) : content;

                setOpenFile({
                    name: fileName,
                    content: parsedContent,
                    isJSON: isJSON
                });
                return { output: "", type: "success" };
            }
            return { output: "File not found or is a directory", type: "error" };
        },
        sleep: () => {
            setHistory(prev => [...prev, { text: "Shutting down...", type: "system" }]);
            setTimeout(() => {
                onPowerOff();
            }, 1500);
            return { output: "", type: "success" };
        },
        hack: () => {
            setIsHacking(true);
            setHackComplete(false);
            setHistory(prev => [...prev, { text: "INITIATING HACK SEQUENCE...", type: "hack" }]);

            const hackMessages = [
                "Brute-forcing coffee machine password...",
                "Decrypting your childhood memories...",
                "Hacking NASA... Just kidding. ",
                "Stealing cookies... Wait, HTTP cookies? ",
                "Downloading RAM... Error: Insufficient funds. ",
                "HACK COMPLETE! You are now 10% cooler. "
            ];

            hackMessages.forEach((msg, index) => {
                setTimeout(() => {
                    setHistory(prev => [...prev, { text: msg, type: "hack" }]);
                    if (index === hackMessages.length - 1) {
                        setTimeout(() => {
                            setIsHacking(false);
                            setHackComplete(true);
                        }, 1000);
                    }
                }, index * 1500);
            });

            return { output: "", type: "success" };
        }
    };

    const handleHistoryNavigation = e => {
        if (e.key === "ArrowUp") {
            e.preventDefault();
            if (!commandHistory.length) return;

            if (historyIndex === -1) {
                setTempInput(inputValue);
            }

            const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);

            setHistoryIndex(newIndex);
            setInputValue(commandHistory[newIndex]);
        } else if (e.key === "ArrowDown") {
            e.preventDefault();
            if (historyIndex === -1) return;

            if (historyIndex === commandHistory.length - 1) {
                setHistoryIndex(-1);
                setInputValue(tempInput);
            } else {
                const newIndex = Math.min(commandHistory.length - 1, historyIndex + 1);
                setHistoryIndex(newIndex);
                setInputValue(commandHistory[newIndex]);
            }
        }
    };

    const handleCommand = e => {
        if (e.key === "Enter") {
            const input = inputValue.trim();
            const [cmd, ...args] = input.split(" ");

            if (input && (!commandHistory.length || commandHistory[commandHistory.length - 1] !== input)) {
                setCommandHistory(prev => [...prev, input]);
            }

            setHistory(prev => [...prev, { text: `${currentPath}> ${input}`, type: "input" }]);

            if (commands[cmd]) {
                const result = commands[cmd](args.join(" "));
                if (result.type !== "clear") {
                    setHistory(prev => [...prev, { text: result.output, type: result.type }]);
                }
            } else if (input) {
                setHistory(prev => [...prev, { text: "Command not found", type: "error" }]);
            }

            setInputValue("");
            setHistoryIndex(-1);
            setTempInput("");

            setTimeout(() => {
                historyRef.current?.scrollTo(0, historyRef.current.scrollHeight);
            }, 0);
        }
    };

    const handleCloseFile = () => {
        setIsClosing(true);
        setTimeout(() => {
            setOpenFile(null);
            setIsClosing(false);
        }, 300);
    };

    useEffect(() => {
        inputRef.current?.focus();
    }, []);

    // Helper function to get available completions
    const getCompletions = input => {
        const [cmd, ...args] = input.trim().split(" ");
        const lastArg = args[args.length - 1] || "";

        // If we're working with a command that expects paths
        if (["cd", "cat"].includes(cmd)) {
            const currentDirContent = fileSystem[currentPath]?.content || [];

            // Filter items that match the current input
            return currentDirContent.filter(item => item.toLowerCase().startsWith(lastArg.toLowerCase()));
        }

        // If no command yet, show available commands
        if (!cmd || cmd === input.trim()) {
            return Object.keys(commands).filter(command => command.startsWith(input.trim().toLowerCase()));
        }

        return [];
    };

    // Handle tab completion
    const handleTabCompletion = e => {
        if (e.key === "Tab") {
            e.preventDefault();

            const input = inputValue.trim();
            const completions = getCompletions(input);

            if (completions.length === 1) {
                // If only one completion, use it
                const [cmd, ...args] = input.split(" ");
                if (["cd", "cat"].includes(cmd)) {
                    // For commands that work with paths
                    const newValue = `${cmd} ${completions[0]}`;
                    setInputValue(newValue);
                } else if (!cmd || cmd === input.trim()) {
                    // For command completion
                    setInputValue(completions[0] + " ");
                }
                setSuggestions([]);
                setShowSuggestions(false);
                setTabIndex(-1);
            } else if (completions.length > 1) {
                // Show multiple suggestions
                setSuggestions(completions);
                setShowSuggestions(true);
                setTabIndex(-1);
            }
        } else if (e.key === "Escape") {
            // Hide suggestions on escape
            setSuggestions([]);
            setShowSuggestions(false);
            setTabIndex(-1);
        } else if (showSuggestions && e.key === "ArrowDown") {
            // Navigate through suggestions
            e.preventDefault();
            setTabIndex(prev => (prev + 1) % suggestions.length);
        } else if (showSuggestions && e.key === "ArrowUp") {
            // Navigate through suggestions
            e.preventDefault();
            setTabIndex(prev => (prev - 1 + suggestions.length) % suggestions.length);
        } else if (showSuggestions && e.key === "Enter" && tabIndex !== -1) {
            // Use selected suggestion
            e.preventDefault();
            const [cmd, ...args] = inputValue.split(" ");
            if (["cd", "cat"].includes(cmd)) {
                setInputValue(`${cmd} ${suggestions[tabIndex]}`);
            } else {
                setInputValue(suggestions[tabIndex] + " ");
            }
            setSuggestions([]);
            setShowSuggestions(false);
            setTabIndex(-1);
        } else {
            // Reset suggestions state for other keys
            setSuggestions([]);
            setShowSuggestions(false);
            setTabIndex(-1);
        }
    };

    return (
        <>
            <div className={`terminal-container ${isHacking ? "hacking" : ""}`}>
                <div className="terminal-header">
                    <div className="terminal-buttons">
                        <div className="terminal-button red"></div>
                        <div className="terminal-button yellow"></div>
                        <div className="terminal-button green"></div>
                    </div>
                    <div className="terminal-title">portfolio.exe</div>
                </div>
                <div className="terminal-content" ref={historyRef}>
                    {history.map((entry, i) => (
                        <div
                            key={i}
                            className={`terminal-line ${entry.type} ${
                                entry.type === "hack" && !hackComplete ? "glitch-text" : ""
                            }`}
                        >
                            {entry.text}
                        </div>
                    ))}
                    <div className="terminal-input-line">
                        <span>{currentPath}&gt; </span>
                        <input
                            ref={inputRef}
                            type="text"
                            value={inputValue}
                            onChange={e => {
                                setInputValue(e.target.value);
                                // Clear suggestions when input changes
                                setSuggestions([]);
                                setShowSuggestions(false);
                                setTabIndex(-1);
                            }}
                            onKeyDown={e => {
                                if (e.key === "Enter") {
                                    handleCommand(e);
                                    // Clear suggestions after command execution
                                    setSuggestions([]);
                                    setShowSuggestions(false);
                                    setTabIndex(-1);
                                } else if (e.key === "Tab") {
                                    handleTabCompletion(e);
                                } else if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                                    if (!showSuggestions) {
                                        handleHistoryNavigation(e);
                                    } else {
                                        handleTabCompletion(e);
                                    }
                                }
                            }}
                            onBlur={() => {
                                // Optional: Clear suggestions when input loses focus
                                setTimeout(() => {
                                    setSuggestions([]);
                                    setShowSuggestions(false);
                                    setTabIndex(-1);
                                }, 200);
                            }}
                            autoFocus
                        />
                    </div>
                    {showSuggestions && suggestions.length > 0 && (
                        <div className="suggestions-container">
                            {suggestions.map((suggestion, index) => (
                                <div
                                    key={suggestion}
                                    className={`suggestion ${index === tabIndex ? "selected" : ""}`}
                                    onClick={() => {
                                        const [cmd, ...args] = inputValue.split(" ");
                                        if (["cd", "cat"].includes(cmd)) {
                                            setInputValue(`${cmd} ${suggestion}`);
                                        } else {
                                            setInputValue(suggestion + " ");
                                        }
                                        setSuggestions([]);
                                        setShowSuggestions(false);
                                        setTabIndex(-1);
                                        inputRef.current?.focus();
                                    }}
                                >
                                    {suggestion}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {openFile && (
                <>
                    <div className="overlay" onClick={handleCloseFile}></div>
                    <div className={`file-open-animation ${isClosing ? "file-close-animation" : ""}`}>
                        <div className="file-header">
                            <div className="window-controls">
                                <button className="window-button close-btn" onClick={handleCloseFile}></button>
                                <button className="window-button minimize-btn"></button>
                                <button className="window-button maximize-btn"></button>
                            </div>
                            <div className="file-title-section">
                                <div className="file-icon"></div>
                                <div className="file-title">{openFile.name}</div>
                            </div>
                        </div>
                        <div className="file-content">
                            {openFile.isJSON ? <JsonView data={openFile.content} /> : openFile.content}
                        </div>
                    </div>
                </>
            )}
            {isHacking && <div className="matrix-effect"></div>}
        </>
    );
}

function BootSequence({ onComplete }) {
    const [bootSteps, setBootSteps] = useState([]);
    const [isBooting, setIsBooting] = useState(false);

    const bootMessages = [
        "Booting up YashOS...",
        "Loading work experience modules...",
        "Fetching latest projects from /dev/portfolio...",
        "Optimizing skills database...",
        "Compiling terminal interface...",
        "System ready! Type 'help' to explore. 🚀"
    ];

    const startBoot = () => {
        setIsBooting(true);
        setBootSteps([]);

        bootMessages.forEach((message, index) => {
            setTimeout(() => {
                setBootSteps(prev => [...prev, message]);
                if (index === bootMessages.length - 1) {
                    setTimeout(onComplete, 1000);
                }
            }, index * 1000);
        });
    };

    if (!isBooting) {
        return (
            <div className="boot-screen">
                <div className="boot-prompt">
                    <p className="boot-text">Press to power up the kernel</p>
                    <button className="power-button" onClick={startBoot}>
                        <i className="power-icon">⏻</i>
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="boot-sequence">
            {bootSteps.map((step, index) => (
                <div key={index} className="boot-message">
                    {step}
                </div>
            ))}
        </div>
    );
}

function App() {
    const [isBooted, setIsBooted] = useState(false);
    const [theme, setTheme] = useState("dark");

    const toggleTheme = () => {
        const newTheme = theme === "dark" ? "light" : "dark";
        setTheme(newTheme);
        document.documentElement.setAttribute("data-theme", newTheme);
    };

    useEffect(() => {
        // Set initial theme
        document.documentElement.setAttribute("data-theme", theme);
    }, []);

    return (
        <div className="App">
            <button className="theme-toggle" onClick={toggleTheme}>
                {theme === "dark" ? "☀️" : "🌙"}
            </button>
            {!isBooted ? (
                <BootSequence onComplete={() => setIsBooted(true)} />
            ) : (
                <Terminal onPowerOff={() => setIsBooted(false)} />
            )}
        </div>
    );
}

export default App;
