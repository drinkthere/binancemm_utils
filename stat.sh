#!/bin/bash

# 预定义文件名前缀列表
file_prefix_list=("bnmm-btech001.log." "bnmm-btech002.log." "bnmm-btech003.log." "bnmm-btech004.log." "bnmm-btech005.log." "bnmm-ltp146.log." "bnmm-ltp147.log." "bnmm-ltp148.log." "bnmm-ltp149.log." "bnmm-ltp173.log." "bnmm-ltp198.log." "bnmm-ltp214.log." "bnmm-ltp244.log." "bnmm-elkdaphne1.log." "bnmm-elkdaphne2.log." "bnmm-elkdaphne3.log." "bnmm-elkdaphne4.log." )
# 遍历文件名前缀列表
for file_prefix in "${file_prefix_list[@]}"; do
    # 查找当前目录中以该前缀开头的所有文件
    file_list=$(ls "${file_prefix}"* 2>/dev/null)
    # 如果没有匹配的文件，跳过当前前缀
    if [ -z "$file_list" ]; then
        echo "Warning: No files found with prefix '$file_prefix'. Skipping..."
        continue
    fi

    simple_prefix=$(echo "$file_prefix" | sed -E 's/^bnmm-([^.]+)\.log\..*$/\1/')
    # 创建临时文件用于存储当前前缀匹配的文件数据
    temp_file=$(mktemp)
    # 提取匹配文件中的数据
    for file in $file_list; do
        grep "FILLED" "$file" | awk '{print $9, $7}' | sed 's/ordID=//g' >> "$temp_file"
    done

    # 初始化计数
    only_partially_filled=0
    has_filled=0

    # 获取唯一的 ordID 列表
    ordIDs=$(awk '{print $1}' "$temp_file" | sort | uniq)
    # 遍历每个 ordID
    for ordID in $ordIDs; do
        # 检查是否有 filled 和 partially_filled
        filled_count=$(grep "$ordID FILLED" "$temp_file" | wc -l)
        partially_filled_count=$(grep "$ordID PARTIALLY_FILLED" "$temp_file" | wc -l)

        if [ "$filled_count" -gt 0 ]; then
            has_filled=$((has_filled + 1))
        elif [ "$partially_filled_count" -gt 0 ]; then
            only_partially_filled=$((only_partially_filled + 1))
        fi
    done

    # 获取当前时间
    current_time=$(date '+%Y-%m-%d %H:%M:%S')

    # 输出当前前缀的统计结果
    printf "%-20s%-15s%-10s%-10s\n" "$current_time" "$simple_prefix" "$only_partially_filled" "$has_filled"

    # 清理当前前缀的临时文件
    rm "$temp_file"
done
