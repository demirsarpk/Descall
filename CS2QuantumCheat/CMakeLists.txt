cmake_minimum_required(VERSION 3.20)
project(CS2QuantumCheat VERSION 1.0.0 LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 20)
set(CMAKE_CXX_STANDARD_REQUIRED ON)
set(CMAKE_CXX_EXTENSIONS OFF)

# Windows-specific settings
if(WIN32)
    set(CMAKE_WIN32_EXECUTABLE TRUE)
    add_definitions(-DUNICODE -D_UNICODE -DNOMINMAX -DWIN32_LEAN_AND_MEAN)
endif()

# Source directory
set(SRC_DIR ${CMAKE_CURRENT_SOURCE_DIR}/CS2QuantumCheat)

# Include directories
include_directories(
    ${SRC_DIR}/include
    ${CMAKE_CURRENT_SOURCE_DIR}/third_party
)

# All source files
set(CHEAT_SOURCES
    ${SRC_DIR}/src/main.cpp
    ${SRC_DIR}/src/CS2MemoryManager.cpp
    ${SRC_DIR}/src/QuantumAimbot.cpp
    ${SRC_DIR}/src/QuantumAPI.cpp
    ${SRC_DIR}/src/QuantumCloud.cpp
    ${SRC_DIR}/src/QuantumConfig.cpp
    ${SRC_DIR}/src/QuantumCore.cpp
    ${SRC_DIR}/src/QuantumCoreML.cpp
    ${SRC_DIR}/src/QuantumESP.cpp
    ${SRC_DIR}/src/QuantumML.cpp
    ${SRC_DIR}/src/QuantumMemory.cpp
    ${SRC_DIR}/src/QuantumPlugin.cpp
    ${SRC_DIR}/src/QuantumRenderer.cpp
    ${SRC_DIR}/src/QuantumUI.cpp
    ${SRC_DIR}/src/QuantumUpdater.cpp
    ${SRC_DIR}/src/QuantumVAC.cpp
)

# All header files (for IDE support)
set(CHEAT_HEADERS
    ${SRC_DIR}/include/QuantumAimbot.h
    ${SRC_DIR}/include/QuantumAPI.h
    ${SRC_DIR}/include/QuantumCloud.h
    ${SRC_DIR}/include/QuantumConfig.h
    ${SRC_DIR}/include/QuantumCore.h
    ${SRC_DIR}/include/QuantumCoreML.h
    ${SRC_DIR}/include/QuantumESP.h
    ${SRC_DIR}/include/QuantumML.h
    ${SRC_DIR}/include/QuantumMemory.h
    ${SRC_DIR}/include/QuantumPlugin.h
    ${SRC_DIR}/include/QuantumRenderer.h
    ${SRC_DIR}/include/QuantumUI.h
    ${SRC_DIR}/include/QuantumUpdater.h
    ${SRC_DIR}/include/QuantumVAC.h
)

# Main executable
add_executable(CS2QuantumCheat ${CHEAT_SOURCES} ${CHEAT_HEADERS})

# Compiler options
if(MSVC)
    target_compile_options(CS2QuantumCheat PRIVATE
        /W3
        /O2
        /GL
        /MP
        /permissive-
        /Zc:__cplusplus
    )
    target_link_options(CS2QuantumCheat PRIVATE
        /LTCG
        /OPT:REF
        /OPT:ICF
    )
else()
    target_compile_options(CS2QuantumCheat PRIVATE
        -O3
        -march=native
        -Wall
        -Wextra
    )
endif()

# Windows libraries
if(WIN32)
    target_link_libraries(CS2QuantumCheat PRIVATE
        d3d11
        d3d12
        dxgi
        dwrite
        d2d1
        user32
        gdi32
        winspool
        comdlg32
        advapi32
        shell32
        ole32
        oleaut32
        uuid
        winhttp
        crypt32
        ws2_32
        iphlpapi
        shlwapi
        psapi
    )
endif()

# Output directory
set_target_properties(CS2QuantumCheat PROPERTIES
    RUNTIME_OUTPUT_DIRECTORY ${CMAKE_BINARY_DIR}/bin
    RUNTIME_OUTPUT_DIRECTORY_RELEASE ${CMAKE_BINARY_DIR}/bin/Release
    RUNTIME_OUTPUT_DIRECTORY_DEBUG ${CMAKE_BINARY_DIR}/bin/Debug
)

# Installation
install(TARGETS CS2QuantumCheat
    RUNTIME DESTINATION bin
)

# Print configuration summary
message(STATUS "")
message(STATUS "CS2 Quantum Cheat Build Configuration")
message(STATUS "=====================================")
message(STATUS "Version:        ${PROJECT_VERSION}")
message(STATUS "Build Type:     ${CMAKE_BUILD_TYPE}")
message(STATUS "C++ Standard:   ${CMAKE_CXX_STANDARD}")
message(STATUS "Compiler:       ${CMAKE_CXX_COMPILER_ID} ${CMAKE_CXX_COMPILER_VERSION}")
message(STATUS "Source files:   ${CHEAT_SOURCES}")
message(STATUS "Output dir:     ${CMAKE_BINARY_DIR}/bin")
message(STATUS "")
